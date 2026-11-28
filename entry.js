'use strict';

const primary = document.getElementById('primary');
const backup = document.getElementById('backup');
const status = document.getElementById('status');
const timeout = 2800;
let pendingEntry = null;
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

async function enterSite(event) {
  if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const enter = event.currentTarget;
  const path = new URL(enter.href).pathname;
  primary.pathname = backup.pathname = path;
  const checking = pendingEntry !== null;
  pendingEntry?.removeAttribute('aria-busy');
  pendingEntry = enter;
  enter.setAttribute('aria-busy', 'true');
  status.textContent = path === '/training' ? '正在连接训练中心…' : '正在连接模型成果首页…';
  if (checking) return;

  try {
    const backupCheck = reachable(backup.href);
    if (await reachable(primary.href)) {
      location.assign(primary.href);
    } else if (await backupCheck) {
      status.textContent = '正在打开 Vercel 备用入口…';
      location.assign(backup.href);
    } else {
      status.textContent = '两条线路暂未通过连接检查。可重试或手动打开上面的链接。';
    }
  } finally {
    pendingEntry.removeAttribute('aria-busy');
    pendingEntry = null;
  }
}

for (const link of document.querySelectorAll('.entry-actions a')) link.addEventListener('click', enterSite);

window.addEventListener('pageshow', event => {
  if (event.persisted) {
    status.textContent = '';
    primary.pathname = backup.pathname = '/';
  }
});
