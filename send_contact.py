import smtplib
from email.mime.text import MIMEText
import sys
import json
import os

def send_contact_email():
    # Attempt to load credentials from config file
    try:
        with open('src/email_config.json', 'r') as f:
            config = json.load(f)
            sender = config.get('gmail_address')
            app_password = config.get('gmail_app_password')
            recipient = config.get('recipient_email')
    except Exception as e:
        print("Error: src/email_config.json not found or invalid.")
        sys.exit(1)

    if not sender or not app_password or not recipient:
        print("Error: Missing email credentials in email_config.json")
        sys.exit(1)

    # Read the submitted contact form data
    try:
        with open('data/contact.json', 'r') as f:
            contact_data = json.load(f)
            name = contact_data.get('name', 'Unknown')
            email = contact_data.get('email', 'Unknown')
            message = contact_data.get('message', 'No message content.')
    except Exception as e:
        print("Error: Failed to read data/contact.json:", e)
        sys.exit(1)

    msg_body = f"""New Contact Form Submission

Name: {name}
Email: {email}

Message:
{message}
"""

    msg = MIMEText(msg_body)
    msg['Subject'] = f"Portfolio Contact: {name}"
    msg['From'] = sender
    msg['To'] = recipient
    msg.add_header('reply-to', email)

    try:
        server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
        server.login(sender, app_password)
        server.send_message(msg)
        server.quit()
        print("SUCCESS")
        
        # Clean up the temp file
        if os.path.exists('data/contact.json'):
            os.remove('data/contact.json')
            
    except Exception as e:
        print("Error sending email:", e)
        sys.exit(1)

if __name__ == '__main__':
    send_contact_email()
