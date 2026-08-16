import sys
import hashlib
import json
import os

# bcrypt is used only for legacy bcrypt hashes in admin_pass.txt
try:
    import bcrypt
    BCRYPT_AVAILABLE = True
except ImportError:
    BCRYPT_AVAILABLE = False

ADMIN_HASH_PATH = "data/admin_hash.json"


def sha256_hex(plain_text):
    return hashlib.sha256(plain_text.encode('utf-8')).hexdigest()


def verify_password(plain_text):
    """Verify against data/admin_hash.json (SHA-256). Falls back to bcrypt admin_pass.txt."""
    # Primary: check data/admin_hash.json
    if os.path.exists(ADMIN_HASH_PATH):
        try:
            with open(ADMIN_HASH_PATH, 'r') as f:
                data = json.load(f)
            stored = data.get('sha256', '')
            if stored and sha256_hex(plain_text) == stored:
                print("OK")
                return 0
            else:
                print("FAIL")
                return 1
        except Exception as e:
            print(f"ERROR reading admin_hash.json: {e}")
            return 1

    # Fallback: legacy bcrypt in src/admin_pass.txt
    if BCRYPT_AVAILABLE and os.path.exists("src/admin_pass.txt"):
        try:
            with open("src/admin_pass.txt", 'r') as f:
                bcrypt_hash = f.read().strip()
            if bcrypt.checkpw(plain_text.encode('utf-8'), bcrypt_hash.encode('utf-8')):
                print("OK")
                return 0
        except Exception:
            pass
    print("FAIL")
    return 1


def hash_and_save(plain_text):
    """Hash the password with SHA-256 and save to data/admin_hash.json."""
    try:
        os.makedirs("data", exist_ok=True)
        new_hash = sha256_hex(plain_text)
        with open(ADMIN_HASH_PATH, 'w') as f:
            json.dump({"sha256": new_hash}, f, indent=4)
        # Also print hash so C server can capture it if needed
        print(new_hash)
        return 0
    except Exception as e:
        print(f"ERROR: {e}")
        return 1


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python auth.py <verify|hash> [password]")
        sys.exit(1)

    action = sys.argv[1]

    if action == 'hash':
        if len(sys.argv) < 3:
            print("Usage: python auth.py hash <plain_password>")
            sys.exit(1)
        sys.exit(hash_and_save(sys.argv[2]))

    elif action == 'verify':
        if len(sys.argv) < 3:
            print("Usage: python auth.py verify <plain_password>")
            sys.exit(1)
        sys.exit(verify_password(sys.argv[2]))

    else:
        print("Unknown action. Use: verify | hash")
        sys.exit(1)
