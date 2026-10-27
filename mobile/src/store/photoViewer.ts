import { create } from 'zustand';

/** Which proof photo is open full screen (any screen can open one). */
export const usePhotoViewer = create<{ open: { id: string; title?: string; subtitle?: string } | null }>(() => ({ open: null }));
export const openPhoto = (id: string, meta: { title?: string; subtitle?: string } = {}) => usePhotoViewer.setState({ open: { id, ...meta } });
export const closePhoto = () => usePhotoViewer.setState({ open: null });
