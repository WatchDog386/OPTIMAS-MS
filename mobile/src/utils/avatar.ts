import { Platform } from 'react-native';
import type { User } from '../api/types';
import { api, ApiError } from '../api/client';
import { useAuth } from '../store/auth';
import { toast } from '../store/feedback';

/** Lets the person pick a photo (camera or gallery) and returns it as a File, or null if they cancel. */
function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    let done = false;
    const finish = (f: File | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(f);
    };
    input.onchange = () => finish(input.files?.[0] ?? null);
    // Closing the picker without choosing: the page gets focus back with no file
    window.addEventListener('focus', () => setTimeout(() => finish(input.files?.[0] ?? null), 1000), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/** Shrinks a photo to a 320px square (centre crop) JPEG, so it is small to store and quick to load. */
async function squareJpeg(file: File, size = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('unreadable'));
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Saves (or with null, removes) the person's profile photo and updates the signed-in account. */
async function saveAvatar(image: string | null) {
  const { user } = await api<{ user: User }>('/auth/me/avatar', { method: 'PUT', body: { image } });
  await useAuth.getState().updateUser(user);
  return user;
}

/** Choose a new profile photo: pick, shrink, save. Resolves the updated account, or null. */
export async function changeAvatar(): Promise<User | null> {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
  const file = await pickImage();
  if (!file) return null;
  if (!file.type.startsWith('image/')) {
    toast.warning('Choose a photo', 'That file is not a picture.');
    return null;
  }
  try {
    const user = await saveAvatar(await squareJpeg(file));
    toast.success('Photo updated', 'Your new profile photo is saved.');
    return user;
  } catch (e) {
    toast.error('Photo not saved', e instanceof ApiError ? e.message : e instanceof Error && e.message === 'unreadable' ? 'That picture could not be opened. Try another one.' : 'Try again');
    return null;
  }
}

export async function removeAvatar(): Promise<User | null> {
  try {
    const user = await saveAvatar(null);
    toast.success('Photo removed');
    return user;
  } catch (e) {
    toast.error('Photo not removed', e instanceof ApiError ? e.message : 'Try again');
    return null;
  }
}
