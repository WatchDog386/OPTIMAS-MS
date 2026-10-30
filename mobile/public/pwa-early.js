/* Loads before the app: keeps the browser's "can be installed" event, which often fires before the app's
   code has downloaded, so the Install button can install in one tap. (A file, not inline: the security
   policy only runs scripts from our own server.) */
window.__optimasInstall = null;
window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  window.__optimasInstall = e;
  window.dispatchEvent(new Event('optimas-installable'));
});
window.addEventListener('appinstalled', function () {
  window.__optimasInstall = null;
});
