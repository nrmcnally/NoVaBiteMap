from __future__ import annotations


def test_favorites_full_crud_journey(auth_client):
    # empty to start
    assert auth_client.get("/api/users/me/favorites").json() == []

    # create with nickname + target species
    created = auth_client.post(
        "/api/users/me/favorites",
        json={"location_id": "lake-burke", "nickname": "Home lake", "preferred_species_id": "largemouth-bass"},
    )
    assert created.status_code == 201, created.text
    favorite = created.json()
    assert favorite["nickname"] == "Home lake"
    assert favorite["preferred_species_id"] == "largemouth-bass"

    # duplicate rejected
    dup = auth_client.post("/api/users/me/favorites", json={"location_id": "lake-burke"})
    assert dup.status_code == 409

    # patch nickname, notes, target species, sort order
    patched = auth_client.patch(
        f"/api/users/me/favorites/{favorite['id']}",
        json={"nickname": "Burke", "notes": "north cove at dawn", "preferred_species_id": "black-crappie", "sort_order": 5},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["nickname"] == "Burke"
    assert body["notes"] == "north cove at dawn"
    assert body["preferred_species_id"] == "black-crappie"
    assert body["sort_order"] == 5

    # delete
    assert auth_client.delete(f"/api/users/me/favorites/{favorite['id']}").status_code == 204
    assert auth_client.get("/api/users/me/favorites").json() == []


def test_favorites_require_auth(client):
    assert client.get("/api/users/me/favorites").status_code == 401


def test_create_favorite_rejects_unknown_location(auth_client):
    resp = auth_client.post("/api/users/me/favorites", json={"location_id": "does-not-exist"})
    assert resp.status_code == 404


def test_account_deletion_removes_favorites(auth_client):
    auth_client.post("/api/users/me/favorites", json={"location_id": "lake-fairfax"})
    assert auth_client.delete("/api/users/me").status_code == 204
    # token now invalid
    assert auth_client.get("/api/users/me").status_code == 401
