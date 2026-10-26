import { Platform } from 'react-native';

/**
 * Adds a picture to multipart form data on every platform.
 * Phones accept the { uri, name, type } shorthand; browsers only send a real file, so on web the
 * picture (a data: or blob: address) is turned into a Blob first. Without this the browser sends
 * the text "[object Object]" and the server never receives the photo.
 */
export async function appendFile(form: FormData, field: string, uri: string, name: string, type: string) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    form.append(field, blob.type ? blob : blob.slice(0, blob.size, type), name);
    return;
  }
  form.append(field, { uri, name, type } as unknown as Blob);
}
