/**
 * WanderStay Notification System Client Script
 * Handles real-time polling, dropdown interactions, and badge updates
 */
document.addEventListener('DOMContentLoaded', () => {
  const notifDropdownBtn = document.getElementById('notifDropdownBtn');
  const badge = document.getElementById('navbarNotifBadge');
  const dropdownChip = document.getElementById('dropdownUnreadChip');
  const markAllForm = document.getElementById('markAllReadForm');
  const listContainer = document.getElementById('notifListContainer');

  if (!notifDropdownBtn) return; // Not logged in

  // Helper to format date
  function formatNotifTime(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);

    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }

  // Poll for unread notifications every 30 seconds
  async function checkNotifications() {
    try {
      const res = await fetch('/notifications/api/unread', {
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) return;
      const data = await res.json();

      updateBadge(data.unreadCount);
      if (data.recent && listContainer) {
        renderDropdownList(data.recent);
      }
    } catch (e) {
      // Silently ignore network failures in background polling
    }
  }

  function updateBadge(count) {
    if (count > 0) {
      if (badge) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.classList.remove('d-none');
      } else {
        // Create badge if it wasn't rendered originally
        const newBadge = document.createElement('span');
        newBadge.className = 'notif-badge-pill';
        newBadge.id = 'navbarNotifBadge';
        newBadge.textContent = count > 99 ? '99+' : count;
        notifDropdownBtn.appendChild(newBadge);
      }
      if (dropdownChip) {
        dropdownChip.textContent = `${count} unread`;
        dropdownChip.classList.remove('d-none');
      }
    } else {
      if (badge) badge.remove();
      if (dropdownChip) dropdownChip.classList.add('d-none');
    }
  }

  function renderDropdownList(items) {
    if (!listContainer) return;
    if (items.length === 0) {
      listContainer.innerHTML = `
        <div class="notif-empty-state">
          <div class="notif-empty-icon"><i class="fa-regular fa-bell-slash"></i></div>
          <div class="notif-empty-title">All caught up!</div>
          <p class="notif-empty-desc">No new notifications right now.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = items.map(n => `
      <a href="/notifications/${n._id}/open" class="notif-item ${!n.isRead ? 'unread' : ''}" data-notif-id="${n._id}">
        <div class="notif-icon-avatar" style="background-color: ${n.meta.bg}; color: ${n.meta.color};">
          <i class="${n.meta.icon}"></i>
        </div>
        <div class="notif-body">
          <div class="notif-item-title">${escapeHtml(n.title)}</div>
          <div class="notif-item-msg">${escapeHtml(n.message)}</div>
          <div class="notif-item-time">
            <i class="fa-regular fa-clock"></i>
            <span>${formatNotifTime(n.createdAt)}</span>
          </div>
        </div>
        ${!n.isRead ? '<div class="notif-unread-dot" title="Unread"></div>' : ''}
      </a>
    `).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  // Handle Mark All As Read asynchronously if form clicked
  if (markAllForm) {
    markAllForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const res = await fetch('/notifications/read-all', {
          method: 'POST',
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          updateBadge(0);
          document.querySelectorAll('.notif-item.unread').forEach(el => el.classList.remove('unread'));
          document.querySelectorAll('.notif-unread-dot').forEach(el => el.remove());
          if (markAllForm) markAllForm.style.display = 'none';
        } else {
          markAllForm.submit(); // fallback to normal submit
        }
      } catch (err) {
        markAllForm.submit();
      }
    });
  }

  // Start polling interval: 30 seconds
  setInterval(checkNotifications, 30000);
});
