'use strict';

const enter = document.getElementById('enter');
const primary = document.getElementById('primary').href;
const backup = document.getElementById('backup').href;
const status = document.getElementById('status');
const timeout = 2800;
let pending = false;
const card = document.querySelector('.entrance-card');
const art = card.querySelector('.specimen');
const artToggle = document.getElementById('change-art');
artToggle.hidden = false;
artToggle.onclick = () => {
  const interactive = art.hidden;
  art.hidden = !interactive;
  card.classList.toggle('interactive', interactive);
  artToggle.setAttribute('aria-pressed', String(interactive));
  artToggle.textContent = interactive ? '返回封面插画' : '转动立体苹果';
  document.dispatchEvent(new CustomEvent('orchard-screen', {detail:{scene: interactive ? art : null}}));
};

function reachable(origin) {
  // The two hosts serve this public stylesheet independently of login.
  // A non-matching media query keeps it from applying to the entry page.
  return new Promise(resolve => {
    const link = document.createElement('link');
    const finish = ok => {
      clearTimeout(timer);
      link.onload = link.onerror = null;
      link.remove();
      resolve(ok);
    };
    const timer = setTimeout(() => finish(false), timeout);
    const url = new URL('/app.css', origin);
    url.searchParams.set('check', String(Date.now()));
    link.rel = 'stylesheet';
    link.media = 'not all';
    link.href = url.href;
    link.onload = () => finish(true);
    link.onerror = () => finish(false);
    document.head.append(link);
  });
}

enter.addEventListener('click', async event => {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  if (pending) return;
  pending = true;
  enter.setAttribute('aria-busy', 'true');
  status.textContent = '正在检查入口…';

  try {
    const backupCheck = reachable(backup);
    if (await reachable(primary)) {
      location.assign(primary);
    } else if (await backupCheck) {
      status.textContent = '正在打开 Vercel 备用入口…';
      location.assign(backup);
    } else {
      status.textContent = '两条线路暂未通过连接检查。可重试或手动打开上面的链接。';
    }
  } finally {
    pending = false;
    enter.removeAttribute('aria-busy');
  }
});

window.addEventListener('pageshow', event => {
  if (event.persisted) status.textContent = '';
});
