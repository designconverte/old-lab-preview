/* global document, FormData, navigator, sessionStorage, window */

const MAX_LOGO_SIZE = 15 * 1024 * 1024;
const ACCEPTED_LOGO_EXTENSIONS = new Set(['svg', 'pdf', 'ai', 'eps', 'png', 'jpg', 'jpeg', 'webp']);

const form = document.querySelector('#briefing-form');
const submitButton = document.querySelector('.briefing-submit');
const statusBox = document.querySelector('[data-briefing-status]');
const webhookNote = document.querySelector('[data-webhook-note]');
const fileInput = document.querySelector('#company-logo');
const fileLabel = document.querySelector('[data-file-label]');
const projectInput = document.querySelector('[data-project-input]');
const projectBadge = document.querySelector('[data-project-badge]');
const projectName = document.querySelector('[data-project-name]');
const webhookUrl = String(window.OLD_LAB_BRIEFING_WEBHOOK_URL || '').trim();

function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function cleanProjectName(value) {
  return String(value || '')
    .replace(/\+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 120);
}

function getProjectFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryProject = params.get('projeto') || params.get('project');
  if (queryProject) return cleanProjectName(queryProject);

  const pathMatch = decodeURIComponent(window.location.pathname).match(/\/briefing\/projeto=([^/]+)/i);
  return pathMatch ? cleanProjectName(pathMatch[1]) : '';
}

function formatCnpj(value) {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPhone(value) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }

  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function normalizeInstagram(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.includes('instagram.com')) return `https://${trimmed.replace(/^@/, '')}`;
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function setError(input, message) {
  const error = document.querySelector(`[data-error-for="${input.id}"]`);
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
  if (error) error.textContent = message;
}

function validateLogo(input) {
  const file = input.files?.[0];
  if (!file) return 'Envie a logo da empresa.';

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !ACCEPTED_LOGO_EXTENSIONS.has(extension)) {
    return 'Envie SVG, PDF, AI, EPS, PNG, JPG ou WebP.';
  }

  if (file.size > MAX_LOGO_SIZE) {
    return 'O arquivo deve ter até 15 MB.';
  }

  return '';
}

function validateForm() {
  const fields = [...form.querySelectorAll('input[required]')];
  let isValid = true;

  for (const field of fields) {
    let message = '';

    if (field.type === 'file') {
      message = validateLogo(field);
    } else if (!field.value.trim()) {
      message = 'Preencha este campo.';
    } else if (field.id === 'company-cnpj' && onlyDigits(field.value).length !== 14) {
      message = 'Informe um CNPJ com 14 dígitos.';
    } else if (
      (field.id === 'sales-whatsapp' || field.id === 'support-whatsapp') &&
      onlyDigits(field.value).length < 10
    ) {
      message = 'Informe o WhatsApp com DDD.';
    } else if (field.id === 'company-instagram' && field.value.trim().length < 3) {
      message = 'Informe o perfil do Instagram.';
    }

    setError(field, message);
    if (message) isValid = false;
  }

  return isValid;
}

function setStatus(type, message) {
  statusBox.className = `briefing-status is-${type}`;
  statusBox.textContent = message;
}

function appendMetadata(formData) {
  const project = cleanProjectName(projectInput?.value);
  if (project) formData.set('projeto', project);
  formData.set('instagram', normalizeInstagram(formData.get('instagram')));
  formData.set('cnpjNumeros', onlyDigits(formData.get('cnpj')));
  formData.set('whatsappVendasNumeros', onlyDigits(formData.get('whatsappVendas')));
  formData.set('whatsappAssistenciaNumeros', onlyDigits(formData.get('whatsappAssistencia')));
  formData.set('paginaOrigem', window.location.href);
  formData.set('userAgent', navigator.userAgent);
  formData.set('enviadoEm', new Date().toISOString());
}

function setupCursor() {
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cursor = document.querySelector('.cursor-orb');
  if (!cursor || !hasFinePointer || reducedMotion) return;

  window.addEventListener('pointermove', (event) => {
    document.documentElement.classList.add('has-custom-cursor');
    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
    cursor.classList.add('is-visible');
    const actionElement = document.elementFromPoint(event.clientX, event.clientY)?.closest('a, button, label, input');
    cursor.classList.toggle('is-action', Boolean(actionElement));
  });
}

function setupProjectIdentifier() {
  const project = getProjectFromUrl();
  if (!project) return;

  if (projectInput) projectInput.value = project;
  if (projectName) projectName.textContent = project;
  if (projectBadge) projectBadge.hidden = false;
}

document.querySelector('#company-cnpj')?.addEventListener('input', (event) => {
  event.target.value = formatCnpj(event.target.value);
});

document.querySelectorAll('#sales-whatsapp, #support-whatsapp').forEach((field) => {
  field.addEventListener('input', (event) => {
    event.target.value = formatPhone(event.target.value);
  });
});

fileInput?.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  fileLabel.textContent = file ? file.name : 'Enviar logo';
  setError(fileInput, validateLogo(fileInput));
});

if (webhookUrl && webhookNote) {
  webhookNote.hidden = true;
}

setupProjectIdentifier();

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateForm()) {
    setStatus('error', 'Revise os campos destacados antes de enviar.');
    return;
  }

  const formData = new FormData(form);
  appendMetadata(formData);

  if (!webhookUrl) {
    sessionStorage.setItem('oldLabBriefingDraft', JSON.stringify(Object.fromEntries(formData.entries())));
    setStatus(
      'pending',
      'Formulário validado. Falta configurar a webhook do N8N para enviar automaticamente ao Telegram.',
    );
    return;
  }

  submitButton.disabled = true;
  submitButton.firstChild.textContent = 'Enviando ';
  setStatus('pending', 'Enviando informações para a Old Lab...');

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Webhook respondeu com status ${response.status}`);
    }

    form.reset();
    fileLabel.textContent = 'Enviar logo';
    setStatus('success', 'Informações enviadas com sucesso. A Old Lab recebeu seu briefing.');
  } catch (error) {
    setStatus('error', `Não foi possível enviar agora: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.firstChild.textContent = 'Enviar informações do projeto ';
  }
});

setupCursor();
