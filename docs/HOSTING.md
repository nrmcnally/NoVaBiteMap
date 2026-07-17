# BiteMap NOVA — Hosting (single always-on VM)

Deploys the **entire stack** (Caddy + web + api + Postgres/PostGIS + Redis) as
Docker Compose on one always-on Linux box. Target: an **Oracle Cloud "Always
Free" ARM VM** (free forever, and Oracle's **Ashburn, VA** region is *in* Northern
Virginia — low latency for your anglers). A ~€4/mo Hetzner VPS works identically if
Oracle's free capacity is hard to get.

Result: a secure public site at `https://<your-domain>`, updated with one command.

**Files this uses:** `docker-compose.yml` (base) + `docker-compose.prod.yml`
(adds Caddy/HTTPS) + `Caddyfile` + `deploy.sh` + `.env`.

---

## 0. What you need first
- The repo pushed to GitHub (you'll `git clone` it on the VM).
- A place for the code: any Linux VM with a public IP. Steps below assume **Ubuntu 22.04 (ARM)** on Oracle.

---

## 1. Create the VM (Oracle Always Free ARM)
1. Oracle Cloud account → **Compute → Instances → Create**.
2. Image **Ubuntu 22.04**; Shape **Ampere A1 (VM.Standard.A1.Flex)**, e.g. **2 OCPU / 12 GB** (all free).
3. Region: **US East (Ashburn)** for NoVa users.
4. Add your SSH public key, create, note the **public IP**.

> **Heads-up:** free ARM capacity is popular and may return *"Out of capacity."*
> Retry over a few hours, or try another availability domain. This is the one real
> annoyance of the free tier — nothing else here is hard.

SSH in: `ssh ubuntu@<public-ip>`

---

## 2. Open the firewall — BOTH layers (the classic Oracle trap)
Oracle blocks traffic in two places; you must open **80** and **443** in each.

**a) Cloud firewall:** Oracle console → your VCN → **Security Lists** (or the NSG)
→ **Add Ingress Rules**: Source `0.0.0.0/0`, IP Protocol TCP, Destination port
`80`, then again `443`.

**b) OS firewall (on the VM):**
```bash
sudo iptables -I INPUT -p tcp --dport 80  -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```
(If it's an Oracle Linux box instead, use firewalld:
`sudo firewall-cmd --add-port=80/tcp --add-port=443/tcp --permanent && sudo firewall-cmd --reload`.)

Leave only **22, 80, 443** open — the stack's other ports stay internal.

---

## 3. Install Docker
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```
Log out and back in (so your user can run Docker). The Compose plugin is included.

---

## 4. Get a domain + point it at the VM
You need a **name** (not just the IP) so Caddy can issue an HTTPS cert. A free one is fine.

**Free (recommended for the alpha) — DuckDNS:**
1. Sign in at **duckdns.org**, create a subdomain, e.g. `bitemap-nova` → `bitemap-nova.duckdns.org`.
2. Set its IP to your VM's public IP (paste the IP in DuckDNS and Update, or run):
   ```bash
   curl "https://www.duckdns.org/update?domains=bitemap-nova&token=YOUR_TOKEN&ip=<public-ip>"
   ```
3. Confirm it resolves: `ping bitemap-nova.duckdns.org` → your VM IP.

**Paid (later, for a polished public launch):** a `.com` (~$10–12/yr, Porkbun/Cloudflare/Namecheap) → add a DNS **A record** → VM IP.

---

## 5. Clone + configure
```bash
git clone <your-github-repo-url> bitemap && cd bitemap
cp .env.example .env
nano .env
```
Set at least:
- `POSTGRES_PASSWORD` — a long random string.
- `DOMAIN` — your domain, e.g. `bitemap-nova.duckdns.org` (no `https://`).
- `ACME_EMAIL` — your email (Let's Encrypt expiry notices).
- `BITEMAP_ADMIN_EMAILS` — your email (enables reseed/admin for you only).
- `NWS_USER_AGENT` — `BiteMap-NOVA/0.2 (contact: your-real-email)` (NWS asks for a real contact).

---

## 6. Deploy
```bash
chmod +x deploy.sh
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
First build is slow (compiles everything natively on ARM — normal). After that,
`./deploy.sh` does everything.

---

## 7. Verify
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```
Wait for **api = healthy** and **web = healthy** (api runs migrations + seed first —
if the seed fails it fails loudly rather than serving empty). Then open
**`https://<your-domain>`** in a browser — you should get the map with a valid
padlock. Create an account and save a spot to confirm the full journey.

---

## 8. Updating (push new code / data)
On your laptop: commit and `git push`. On the VM:
```bash
./deploy.sh          # git pull + rebuild only what changed + restart
```
~5–15 s of downtime. **Accounts, favorites, and the TLS cert persist** (Postgres +
Caddy volumes). Fish-data updates redeploy the same way — the seed re-loads
automatically when its checksum changes.

---

## 9. Back up the database (do this)
Oracle can occasionally reclaim free resources, so keep backups:
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
  pg_dump -U bitemap bitemap > backup-$(date +%F).sql
```
Copy it off the box (`scp`) periodically, or add it to a weekly `cron` job.

---

## 10. Troubleshooting
- **Site won't load at all** → 90% of the time it's the firewall. Re-check **both**
  layers in step 2. Test from elsewhere: `curl -v http://<your-domain>`.
- **No HTTPS / cert error** → Caddy needs port **80** reachable and DNS resolving to
  the VM. Check DNS propagated, then `docker compose -f docker-compose.yml -f docker-compose.prod.yml logs caddy`.
  (Let's Encrypt has rate limits — the `caddy_data` volume prevents re-requests, so
  don't delete it.)
- **api stuck "starting"/"unhealthy"** → `... logs api`; it's a migration or seed
  problem. `/health` intentionally reports unhealthy on an empty DB.
- **Everything else** → `... logs -f` (all services) shows the live picture.

---

## When to graduate off the single VM
This single-box setup is right for the alpha and a modest public launch. The
regional-scale upgrades (per-gridpoint forecasts, shared cache, splitting the DB to
managed Postgres) are tracked in [SCALING.md](SCALING.md) — do them when traffic
justifies it, not before.
