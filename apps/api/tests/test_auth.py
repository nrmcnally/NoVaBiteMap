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


if __name__ == "__main__":
    unittest.main()

