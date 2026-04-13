import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('mixcut', {
  ping: () => 'pong',
});
