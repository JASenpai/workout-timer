import os
from PIL import Image, ImageDraw

os.makedirs('/root/workout-timer', exist_ok=True)

for size in [192, 512]:
    im = Image.new('RGB', (size, size), color='#1A365D')
    d = ImageDraw.Draw(im)
    # Draw dumbbell shape
    d.rectangle([size*0.3, size*0.45, size*0.7, size*0.55], fill='#3182CE')
    d.rectangle([size*0.2, size*0.3, size*0.3, size*0.7], fill='#ED8936')
    d.rectangle([size*0.7, size*0.3, size*0.8, size*0.7], fill='#ED8936')
    im.save(f'/root/workout-timer/icon-{size}.png')

print("Icons generated without emoji.")
