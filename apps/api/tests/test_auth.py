from __future__ import annotations

import pathlib
import sys
import unittest

API_ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))

from app.auth.service import hash_password, verify_password  # noqa: E402


class PasswordTests(unittest.TestCase):
    def test_password_hash_is_salted_and_verifiable(self):
        first = hash_password("correct horse battery staple")
        second = hash_password("correct horse battery staple")
        self.assertNotEqual(first, second)
        self.assertTrue(verify_password("correct horse battery staple", first))
        self.assertFalse(verify_password("wrong", first))
        self.assertTrue(first.startswith("pbkdf2_sha256$600000$"))


def test_register_login_me_logout_journey(client):
    email = "alpha-account@example.com"
    password = "a unique alpha password"
    registered = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "display_name": "Alpha Angler"},
    )
    assert registered.status_code == 201, registered.text
    first_token = registered.json()["access_token"]
    first_headers = {"Authorization": f"Bearer {first_token}"}
    me = client.get("/api/users/me", headers=first_headers)
    assert me.status_code == 200
    assert me.json()["email"] == email
    assert me.json()["display_name"] == "Alpha Angler"

    duplicate = client.post(
        "/api/auth/register",
        json={"email": email.upper(), "password": password},
    )
    assert duplicate.status_code == 409

    bad_login = client.post("/api/auth/login", json={"email": email, "password": "wrong"})
    assert bad_login.status_code == 401

    logged_in = client.post("/api/auth/login", json={"email": email, "password": password})
    assert logged_in.status_code == 200
    second_token = logged_in.json()["access_token"]
    second_headers = {"Authorization": f"Bearer {second_token}"}
    assert client.get("/api/users/me", headers=second_headers).status_code == 200
    assert client.post("/api/auth/logout", headers=second_headers).status_code == 204
    assert client.get("/api/users/me", headers=second_headers).status_code == 401


if __name__ == "__main__":
    unittest.main()
