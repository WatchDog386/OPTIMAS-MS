import { createContext, useContext } from 'react';

/**
 * Tells components whether they are drawn on a dark (navy hero) surface,
 * so text, buttons and icons can flip to their on-dark variants automatically.
 */
export const SurfaceContext = createContext<{ inverse: boolean }>({ inverse: false });
export const useInverse = () => useContext(SurfaceContext).inverse;
