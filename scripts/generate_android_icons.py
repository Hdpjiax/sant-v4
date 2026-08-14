from PIL import Image, ImageDraw
import numpy as np
import os

# 1. Load source image
src = Image.open('assets/unnamed.png').convert('RGBA')
arr = np.array(src)

# Find flame bounding box
red_mask = (arr[:,:,0] > 160) & (arr[:,:,1] < 70) & (arr[:,:,2] < 70)
ys, xs = np.where(red_mask)
min_x, min_y, max_x, max_y = xs.min(), ys.min(), xs.max(), ys.max()

flame_crop = src.crop((min_x, min_y, max_x+1, max_y+1))

def make_icon(size, flame_scale_ratio, bg_color=(255, 255, 255, 255), is_round=False, corner_radius_ratio=0.20, transparent_bg=False):
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0) if transparent_bg or is_round or corner_radius_ratio > 0 else bg_color)
    
    if not transparent_bg:
        if is_round:
            draw = ImageDraw.Draw(canvas)
            draw.ellipse((0, 0, size-1, size-1), fill=bg_color)
        elif corner_radius_ratio > 0:
            draw = ImageDraw.Draw(canvas)
            r = int(size * corner_radius_ratio)
            draw.rounded_rectangle((0, 0, size-1, size-1), radius=r, fill=bg_color)
        else:
            draw = ImageDraw.Draw(canvas)
            draw.rectangle((0, 0, size-1, size-1), fill=bg_color)
    
    # Scale flame with balanced zoom
    target_w = int(size * flame_scale_ratio)
    aspect = flame_crop.height / flame_crop.width
    target_h = int(target_w * aspect)
    
    resized_flame = flame_crop.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    pos_x = (size - target_w) // 2
    pos_y = (size - target_h) // 2
    
    canvas.paste(resized_flame, (pos_x, pos_y), resized_flame if resized_flame.mode == 'RGBA' else None)
    return canvas

# Densities and sizes for Android:
densities = {
    'mipmap-mdpi': {'launcher': 48, 'adaptive': 108},
    'mipmap-hdpi': {'launcher': 72, 'adaptive': 162},
    'mipmap-xhdpi': {'launcher': 96, 'adaptive': 216},
    'mipmap-xxhdpi': {'launcher': 144, 'adaptive': 324},
    'mipmap-xxxhdpi': {'launcher': 192, 'adaptive': 432}
}

res_dir = 'android/app/src/main/res'

for folder, sizes in densities.items():
    folder_path = os.path.join(res_dir, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    l_size = sizes['launcher']
    a_size = sizes['adaptive']
    
    # 1. Standard ic_launcher.png (Rounded square, 65% ratio)
    ic_launcher = make_icon(l_size, 0.65, bg_color=(255, 255, 255, 255), corner_radius_ratio=0.20)
    ic_launcher.save(os.path.join(folder_path, 'ic_launcher.png'), 'PNG')
    
    # 2. Round ic_launcher_round.png (Circle, 64% ratio)
    ic_launcher_round = make_icon(l_size, 0.64, bg_color=(255, 255, 255, 255), is_round=True)
    ic_launcher_round.save(os.path.join(folder_path, 'ic_launcher_round.png'), 'PNG')
    
    # 3. Adaptive Foreground ic_launcher_foreground.png (50% ratio of 108dp canvas -> ~75% of visible 72dp safe zone)
    ic_foreground = make_icon(a_size, 0.50, transparent_bg=True)
    ic_foreground.save(os.path.join(folder_path, 'ic_launcher_foreground.png'), 'PNG')
    
    # 4. Adaptive Background ic_launcher_background.png (Solid white)
    ic_background = Image.new('RGBA', (a_size, a_size), (255, 255, 255, 255))
    ic_background.save(os.path.join(folder_path, 'ic_launcher_background.png'), 'PNG')
    
    print(f"Generated balanced icons for {folder}: launcher={l_size}px, adaptive={a_size}px")

# Also update web icons in icons/
web_icon_sizes = [48, 72, 96, 128, 192, 256, 512]
for sz in web_icon_sizes:
    icon_web = make_icon(sz, 0.65, bg_color=(255, 255, 255, 255), corner_radius_ratio=0.20)
    icon_web.save(f'icons/icon-{sz}.webp', 'WEBP')

# Save root / assets copies
make_icon(512, 0.65, bg_color=(255, 255, 255, 255), corner_radius_ratio=0).save('assets/icon.png', 'PNG')
make_icon(512, 0.65, bg_color=(255, 255, 255, 255), corner_radius_ratio=0).save('icono_app.webp', 'WEBP')
print("All icons successfully generated with balanced, non-excessive zoom.")
