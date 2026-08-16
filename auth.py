import sys
import bcrypt

def verify_password(hash_str, plain_text):
    try:
        if bcrypt.checkpw(plain_text.encode('utf-8'), hash_str.encode('utf-8')):
            print("OK")
            return 0
        else:
            print("FAIL")
            return 1
    except Exception as e:
        print(f"ERROR: {e}")
        return 1

def hash_password(plain_text):
    try:
        salt = bcrypt.gensalt()
        hashed = bcrypt.hashpw(plain_text.encode('utf-8'), salt)
        print(hashed.decode('utf-8'))
        return 0
    except Exception as e:
        print(f"ERROR: {e}")
        return 1

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python auth.py <verify|hash> <string>")
        sys.exit(1)

    action = sys.argv[1]
    
    if action == 'hash':
        sys.exit(hash_password(sys.argv[2]))
    elif action == 'verify':
        # sys.argv[2] is the plain password, sys.argv[3] should be the hash
        if len(sys.argv) < 4:
            print("Usage: python auth.py verify <plain> <hash>")
            sys.exit(1)
        sys.exit(verify_password(sys.argv[3], sys.argv[2]))
    else:
        print("Unknown action")
        sys.exit(1)
