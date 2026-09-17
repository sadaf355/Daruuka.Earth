"""Auth primitives: password hashing and JWT access/refresh separation."""

import pytest
from jose import JWTError

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_is_not_reversible():
    hashed = hash_password("correct-horse-battery")
    assert hashed != "correct-horse-battery"
    assert verify_password("correct-horse-battery", hashed)
    assert not verify_password("wrong-password", hashed)


def test_same_password_produces_different_hashes():
    """bcrypt salts every hash; identical passwords must not share a digest."""
    assert hash_password("same-password") != hash_password("same-password")


def test_access_token_roundtrip():
    token = create_access_token("user-123")
    assert decode_token(token, expected_type="access") == "user-123"


def test_refresh_token_roundtrip():
    token = create_refresh_token("user-123")
    assert decode_token(token, expected_type="refresh") == "user-123"


def test_refresh_token_is_rejected_as_an_access_token():
    """Token confusion is the classic JWT bug — a refresh token must not open the API."""
    token = create_refresh_token("user-123")
    with pytest.raises(JWTError):
        decode_token(token, expected_type="access")


def test_access_token_is_rejected_as_a_refresh_token():
    token = create_access_token("user-123")
    with pytest.raises(JWTError):
        decode_token(token, expected_type="refresh")


def test_tampered_token_is_rejected():
    token = create_access_token("user-123")
    with pytest.raises(JWTError):
        decode_token(token[:-4] + "aaaa", expected_type="access")
