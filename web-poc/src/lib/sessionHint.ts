/**
 * Runs before first paint (inlined in <head>). The landing page is what the server renders at "/",
 * so someone already signed in would see it flash before their Today screen. This marks <html>
 * when the browser holds a session (the local mock's, or Cognito's), and app.css hides the
 * landing page while the mark is there. It is a hint only: the real check still decides.
 */
export const sessionBootScript = `try{var s=false,m=localStorage.getItem("neurocal.mockAuth");if(m&&JSON.parse(m).session)s=true;for(var i=0;i<localStorage.length&&!s;i++){if(/\\.LastAuthUser$/.test(localStorage.key(i)))s=true}if(s)document.documentElement.dataset.signedIn="1"}catch(e){}`;

/** Called once the session is known to be absent, so the landing page shows. */
export function clearSessionHint() {
  delete document.documentElement.dataset.signedIn;
}
