import smtplib
from email.mime.text import MIMEText
import sys
import json
import os
import random
import string

def generate_temp_password(length=10):
    chars = string.ascii_letters + string.digits
    return ''.join(random.choice(chars) for i in range(length))

def send_reset_email():
    # Attempt to load credentials from a .env or config file
    # For now, we will ask the user to configure these directly here or in a config.json
    try:
        with open('src/email_config.json', 'r') as f:
            config = json.load(f)
            sender = config.get('gmail_address')
            app_password = config.get('gmail_app_password')
            recipient = config.get('recipient_email')
    except Exception as e:
        print("Error: src/email_config.json not found or invalid.")
        print("Please create it with {'gmail_address': '...', 'gmail_app_password': '...', 'recipient_email': '...'}")
        sys.exit(1)

    if not sender or not app_password or not recipient:
        print("Error: Missing email credentials in email_config.json")
        sys.exit(1)

    new_password = generate_temp_password()

    # Update the admin_pass.txt file
    try:
        with open('src/admin_pass.txt', 'w') as f:
            f.write(new_password)
    except Exception as e:
        print("Error writing new password to file:", e)
        sys.exit(1)

    msg_body = f"""Hello,

A password reset was requested for your portfolio admin dashboard.

Your new temporary password is: {new_password}

Please log in and change this password immediately from the Site Data tab.

Best,
Your Portfolio System
"""

    msg = MIMEText(msg_body)
    msg['Subject'] = 'Portfolio Admin Password Reset'
    msg['From'] = sender
    msg['To'] = recipient

    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender, app_password)
        server.send_message(msg)
        server.quit()
        print("SUCCESS")
    except Exception as e:
        print("Error sending email:", e)
        sys.exit(1)

if __name__ == '__main__':
    send_reset_email()
