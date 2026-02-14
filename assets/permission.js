export function showPermissionPrompt({
  title,
  description,
  confirmText = '허용',
  cancelText = '나중에'
}) {
  return new Promise((resolve) => {
    const existing = document.getElementById('permissionModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'permissionModal';
    modal.className = 'permission-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');

    modal.innerHTML = `
      <div class="permission-modal__backdrop"></div>
      <div class="permission-modal__content">
        <h3 class="permission-modal__title">${title}</h3>
        <p class="permission-modal__desc">${description}</p>
        <div class="permission-modal__actions">
          <button type="button" class="permission-modal__btn permission-modal__btn--cancel">${cancelText}</button>
          <button type="button" class="permission-modal__btn permission-modal__btn--confirm">${confirmText}</button>
        </div>
      </div>
    `;

    const cleanup = () => {
      modal.remove();
      document.body.style.overflow = '';
    };

    const resolveAndClose = (value) => {
      cleanup();
      resolve(value);
    };

    modal.querySelector('.permission-modal__backdrop')
      .addEventListener('click', () => resolveAndClose(false));
    modal.querySelector('.permission-modal__btn--cancel')
      .addEventListener('click', () => resolveAndClose(false));
    modal.querySelector('.permission-modal__btn--confirm')
      .addEventListener('click', () => resolveAndClose(true));

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
  });
}
