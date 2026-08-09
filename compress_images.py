import os
from PIL import Image

def compress_images(directory, max_size_mb=1.0, max_dimension=1920):
    max_bytes = max_size_mb * 1024 * 1024
    count = 0
    saved_bytes = 0

    for root, dirs, files in os.walk(directory):
        for file in files:
            ext = file.lower().split('.')[-1]
            if ext in ['jpg', 'jpeg', 'png', 'webp']:
                filepath = os.path.join(root, file)
                original_size = os.path.getsize(filepath)

                if original_size > max_bytes:
                    print(f"Compressing {filepath} ({original_size / 1024 / 1024:.2f} MB)...")
                    try:
                        with Image.open(filepath) as img:
                            # Convert to RGB if necessary (e.g. for RGBA to JPEG)
                            if img.mode in ("RGBA", "P"):
                                img = img.convert("RGB")
                            
                            # Calculate new dimensions
                            width, height = img.size
                            if width > max_dimension or height > max_dimension:
                                if width > height:
                                    new_width = max_dimension
                                    new_height = int(max_dimension * height / width)
                                else:
                                    new_height = max_dimension
                                    new_width = int(max_dimension * width / height)
                                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

                            # Save it back
                            img.save(filepath, format="JPEG" if ext in ['jpg', 'jpeg'] else img.format, quality=80, optimize=True)
                            
                        new_size = os.path.getsize(filepath)
                        saved = original_size - new_size
                        saved_bytes += saved
                        count += 1
                        print(f"  -> Reduced to {new_size / 1024 / 1024:.2f} MB (Saved {saved / 1024 / 1024:.2f} MB)")
                    except Exception as e:
                        print(f"  -> Error processing {filepath}: {e}")

    print(f"\nDone! Compressed {count} images.")
    print(f"Total space saved: {saved_bytes / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    target_dir = os.path.join(os.getcwd(), "public", "images")
    compress_images(target_dir)
