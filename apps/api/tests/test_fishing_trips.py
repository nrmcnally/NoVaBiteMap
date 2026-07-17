from __future__ import annotations

from datetime import datetime, timedelta, timezone


def trip_payload(**overrides):
    ended = datetime.now(timezone.utc) - timedelta(minutes=10)
    started = ended - timedelta(minutes=90)
    payload = {
        "location_id": "lake-burke",
        "species_id": "largemouth-bass",
        "started_at": started.isoformat(),
        "ended_at": ended.isoformat(),
        "timezone": "America/New_York",
        "angler_count": 1,
        "catch_count": 0,
        "location_detail": "north bank",
        "lure_or_bait": "weightless worm",
        "observed_water_temperature_c": 24.5,
        "observed_clarity": "stained",
        "notes": "Two follows; no landed fish.",
        "consent_for_aggregate_analysis": True,
    }
    payload.update(overrides)
    return payload


def test_private_trip_full_create_list_delete_journey(auth_client):
    assert auth_client.get("/api/users/me/fishing-trips").json() == []

    created = auth_client.post("/api/users/me/fishing-trips", json=trip_payload())
    assert created.status_code == 201, created.text
    trip = created.json()
    assert trip["location_id"] == "lake-burke"
    assert trip["species_id"] == "largemouth-bass"
    assert trip["effort_minutes"] == 90
    assert trip["catch_count"] == 0
    assert trip["zero_catch_explicit"] is True
    assert trip["calibration_eligible"] is True
    assert trip["candidate_cohort"] is False
    assert trip["validation_eligible"] is False
    assert trip["condition_replay_status"] == "not-requested"
    assert trip["condition_replay"] is None
    assert "snapshot" not in trip

    listed = auth_client.get("/api/users/me/fishing-trips")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [trip["id"]]

    assert auth_client.delete(f"/api/users/me/fishing-trips/{trip['id']}").status_code == 204
    assert auth_client.get("/api/users/me/fishing-trips").json() == []


def test_trip_candidate_cohort_is_derived_server_side(auth_client):
    created = auth_client.post(
        "/api/users/me/fishing-trips",
        json=trip_payload(species_id="walleye", catch_count=2),
    )
    assert created.status_code == 201, created.text
    assert created.json()["candidate_cohort"] is True
    assert created.json()["calibration_eligible"] is True
    assert created.json()["validation_eligible"] is False


def test_trip_rejects_future_or_reversed_time(auth_client):
    now = datetime.now(timezone.utc)
    reversed_trip = auth_client.post(
        "/api/users/me/fishing-trips",
        json=trip_payload(started_at=now.isoformat(), ended_at=(now - timedelta(hours=1)).isoformat()),
    )
    assert reversed_trip.status_code == 400

    future_trip = auth_client.post(
        "/api/users/me/fishing-trips",
        json=trip_payload(started_at=(now + timedelta(hours=1)).isoformat(), ended_at=(now + timedelta(hours=2)).isoformat()),
    )
    assert future_trip.status_code == 400


def test_trip_rejects_species_not_evidenced_at_spot(auth_client):
    response = auth_client.post(
        "/api/users/me/fishing-trips",
        json=trip_payload(species_id="brook-trout"),
    )
    assert response.status_code == 400
    assert "not evidenced" in response.json()["detail"]


def test_trip_logs_require_auth(client):
    assert client.get("/api/users/me/fishing-trips").status_code == 401
    assert client.post("/api/users/me/fishing-trips", json=trip_payload()).status_code == 401
    assert client.patch(
        "/api/users/me/fishing-trips/not-a-trip/condition-replay",
        json={},
    ).status_code == 401


def test_condition_replay_persists_context_without_promoting_validation(auth_client):
    created = auth_client.post("/api/users/me/fishing-trips", json=trip_payload())
    assert created.status_code == 201, created.text
    trip = created.json()
    replay_id = "9f05d29b-9c71-4141-a8ba-9cd2847d1ac0"
    replayed_at = datetime.now(timezone.utc).isoformat()
    replay = {
        "replayId": replay_id,
        "policyVersion": "historical-replay-v0.1.0",
        "generatedBy": "bitemap-server",
        "reconstructedAt": replayed_at,
        "status": "complete",
        "tripWindow": {
            "locationId": trip["location_id"],
            "startedAt": trip["started_at"],
            "endedAt": trip["ended_at"],
        },
        "coverage": {
            "weather": "complete",
            "hydrology": "not-mapped",
            "solar": "complete",
            "missing": ["location-specific USGS station mapping"],
        },
    }
    updated = auth_client.patch(
        f"/api/users/me/fishing-trips/{trip['id']}/condition-replay",
        json={
            "condition_replay_id": replay_id,
            "condition_replay_status": "complete",
            "condition_replay_policy_version": "historical-replay-v0.1.0",
            "condition_replay": replay,
            "condition_replayed_at": replayed_at,
        },
    )
    assert updated.status_code == 200, updated.text
    body = updated.json()
    assert body["condition_replay_id"] == replay_id
    assert body["condition_replay"]["coverage"]["weather"] == "complete"
    assert body["validation_eligible"] is False
    listed = auth_client.get("/api/users/me/fishing-trips").json()
    assert listed[0]["condition_replay_policy_version"] == "historical-replay-v0.1.0"


def test_condition_replay_rejects_trip_outcome_fields(auth_client):
    created = auth_client.post("/api/users/me/fishing-trips", json=trip_payload())
    trip = created.json()
    replay_id = "e81237ba-1685-4bd1-b01d-44733876eab6"
    replayed_at = datetime.now(timezone.utc).isoformat()
    response = auth_client.patch(
        f"/api/users/me/fishing-trips/{trip['id']}/condition-replay",
        json={
            "condition_replay_id": replay_id,
            "condition_replay_status": "complete",
            "condition_replay_policy_version": "historical-replay-v0.1.0",
            "condition_replayed_at": replayed_at,
            "condition_replay": {
                "replayId": replay_id,
                "policyVersion": "historical-replay-v0.1.0",
                "generatedBy": "bitemap-server",
                "status": "complete",
                "tripWindow": {
                    "locationId": trip["location_id"],
                    "startedAt": trip["started_at"],
                    "endedAt": trip["ended_at"],
                },
                "catchCount": 0,
            },
        },
    )
    assert response.status_code == 400
    assert "outcome" in response.json()["detail"]
