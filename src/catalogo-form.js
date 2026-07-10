/* global File, FormData, crypto, document, navigator, sessionStorage, window */

const MAX_MODEL_PHOTOS = 5;
const ACCEPTED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DEFAULT_FEATURES = [
  'Painel em LED',
  'Buzina',
  'Chave reserva',
  'Farol em LED',
  'Alarme',
  'Bateria removível',
  'Carregador bivolt',
  'Baú',
  'NFC',
  'Bluetooth / App',
  'Ré',
  'Setas',
  'Freio a disco',
];

const form = document.querySelector('#catalog-form');
const modelList = document.querySelector('[data-model-list]');
const editorTitle = document.querySelector('[data-editor-title]');
const modelKicker = document.querySelector('[data-model-kicker]');
const projectInput = document.querySelector('[data-project-input]');
const projectBadges = document.querySelectorAll('[data-project-badge]');
const projectNames = document.querySelectorAll('[data-project-name]');
const statusBox = document.querySelector('[data-catalog-status]');
const submitButton = document.querySelector('.catalog-submit');
const progressLabels = document.querySelectorAll('[data-progress-label]');
const progressPercents = document.querySelectorAll('[data-progress-percent]');
const progressBars = document.querySelectorAll('[data-progress-bar]');
const webhookUrl = String(window.OLD_LAB_CATALOG_WEBHOOK_URL || '').trim();

let activeModelId = '';
let models = [createModel()];

function createId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `model-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanProjectName(value) {
  return cleanText(value).replace(/\+/g, ' ').slice(0, 120);
}

function getProjectFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const queryProject = params.get('projeto') || params.get('project');
  if (queryProject) return cleanProjectName(queryProject);

  const pathMatch = decodeURIComponent(window.location.pathname).match(/\/catalogo\/projeto=([^/]+)/i);
  return pathMatch ? cleanProjectName(pathMatch[1]) : '';
}

function createModel(base = {}) {
  const id = createId();
  const modelBase = { ...base };
  delete modelBase.id;

  return {
    id,
    nome: '',
    categoria: 'autopropelido',
    cnh: 'nao',
    emplacamento: 'nao',
    observacaoLegal: '',
    potencia: '',
    velocidade: '',
    autonomia: '',
    bateria: '',
    recarga: '',
    carga: '',
    peso: '',
    valor: '',
    observacoes: '',
    features: Object.fromEntries(DEFAULT_FEATURES.map((feature) => [feature, false])),
    customFeatures: [],
    colors: [{ id: createId(), nome: 'Cor principal', hex: '#2d6cdf' }],
    photos: [],
    ...modelBase,
  };
}

function getActiveModel() {
  return models.find((model) => model.id === activeModelId) || models[0];
}

function getModelIndex(modelId) {
  return models.findIndex((model) => model.id === modelId);
}

function getModelTitle(model, index) {
  return cleanText(model.nome) || `Modelo ${String(index + 1).padStart(2, '0')}`;
}

function isModelComplete(model) {
  return Boolean(cleanText(model.nome) && cleanText(model.potencia) && cleanText(model.velocidade) && cleanText(model.autonomia) && model.photos.length);
}

function getCompletionLabel(model) {
  if (isModelComplete(model)) return 'Completo';
  if (!cleanText(model.nome)) return 'Falta nome';
  if (!cleanText(model.potencia) || !cleanText(model.velocidade) || !cleanText(model.autonomia)) return 'Faltam specs';
  if (!model.photos.length) return 'Faltam fotos';
  return 'Incompleto';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setStatus(type, message) {
  statusBox.className = `briefing-status is-${type}`;
  statusBox.textContent = message;
}

function setFieldValues(model) {
  form.querySelectorAll('[data-field]').forEach((field) => {
    field.value = model[field.dataset.field] || '';
  });
}

function renderModelList() {
  modelList.innerHTML = models
    .map((model, index) => {
      const isActive = model.id === activeModelId;
      const title = escapeHtml(getModelTitle(model, index));
      const status = getCompletionLabel(model);
      return `
        <button class="catalog-model-card ${isActive ? 'is-active' : ''}" type="button" data-select-model="${model.id}">
          <span>${String(index + 1).padStart(2, '0')}</span>
          <strong>${title}</strong>
          <small>${status}</small>
        </button>
      `;
    })
    .join('');
}

function renderFeatures(model) {
  const featureList = document.querySelector('[data-feature-list]');
  featureList.innerHTML = DEFAULT_FEATURES
    .map((feature) => `
      <label class="catalog-check">
        <input type="checkbox" data-feature="${escapeHtml(feature)}" ${model.features[feature] ? 'checked' : ''} />
        <span>${escapeHtml(feature)}</span>
      </label>
    `)
    .join('');
}

function renderCustomFeatures(model) {
  const list = document.querySelector('[data-custom-feature-list]');
  list.innerHTML = model.customFeatures
    .map((feature, index) => `
      <button class="catalog-tag" type="button" data-remove-feature="${index}">
        ${escapeHtml(feature)}
        <span aria-hidden="true">&times;</span>
      </button>
    `)
    .join('');
}

function renderColors(model) {
  const list = document.querySelector('[data-color-list]');
  list.innerHTML = model.colors
    .map((color) => `
      <article class="catalog-color-row" data-color-row="${color.id}">
        <input type="color" data-color-hex="${color.id}" value="${escapeHtml(color.hex || '#2d6cdf')}" aria-label="Cor do modelo" />
        <input type="text" data-color-name="${color.id}" value="${escapeHtml(color.nome || '')}" placeholder="Nome da cor" />
        <button class="catalog-mini-remove" type="button" data-remove-color="${color.id}" aria-label="Remover cor">&times;</button>
      </article>
    `)
    .join('');
}

function renderPhotos(model) {
  const list = document.querySelector('[data-photo-list]');
  list.innerHTML = model.photos.length
    ? model.photos
      .map((file, index) => `
          <article class="catalog-photo-chip">
            <span>${index === 0 ? 'Principal' : `Foto ${index + 1}`}</span>
            <strong>${escapeHtml(file.name)}</strong>
            <button type="button" data-remove-photo="${index}" aria-label="Remover foto">&times;</button>
          </article>
        `)
      .join('')
    : '<p class="catalog-empty-note">Nenhuma foto selecionada para este modelo.</p>';
}

function renderProgress() {
  const completeCount = models.filter(isModelComplete).length;
  const percent = Math.round((completeCount / models.length) * 100);
  progressLabels.forEach((label) => {
    label.textContent = `${completeCount} de ${models.length} modelos completos`;
  });
  progressPercents.forEach((item) => {
    item.textContent = `${percent}%`;
  });
  progressBars.forEach((bar) => {
    bar.style.width = `${percent}%`;
  });
}

function renderEditor() {
  if (!activeModelId) activeModelId = models[0].id;
  const model = getActiveModel();
  const index = getModelIndex(model.id);

  modelKicker.textContent = `Modelo ${String(index + 1).padStart(2, '0')}`;
  editorTitle.textContent = getModelTitle(model, index);
  setFieldValues(model);
  renderModelList();
  renderFeatures(model);
  renderCustomFeatures(model);
  renderColors(model);
  renderPhotos(model);
  renderProgress();
}

function syncActiveField(field) {
  const model = getActiveModel();
  model[field.dataset.field] = field.value;
  renderModelList();
  renderProgress();
  editorTitle.textContent = getModelTitle(model, getModelIndex(model.id));
}

function addModel() {
  const model = createModel();
  models.push(model);
  activeModelId = model.id;
  renderEditor();
}

function duplicateActiveModel() {
  const current = getActiveModel();
  const clone = createModel({
    ...current,
    nome: current.nome ? `${current.nome} - cópia` : '',
    features: { ...current.features },
    customFeatures: [...current.customFeatures],
    colors: current.colors.map((color) => ({ ...color, id: createId() })),
    photos: [],
  });
  models.push(clone);
  activeModelId = clone.id;
  renderEditor();
}

function removeActiveModel() {
  if (models.length === 1) {
    setStatus('error', 'Mantenha pelo menos um modelo no catálogo.');
    return;
  }

  const index = getModelIndex(activeModelId);
  models = models.filter((model) => model.id !== activeModelId);
  activeModelId = models[Math.max(0, index - 1)].id;
  setStatus('pending', 'Modelo removido do catálogo.');
  renderEditor();
}

function addCustomFeature() {
  const input = document.querySelector('[data-custom-feature-input]');
  const value = cleanText(input.value);
  if (!value) return;

  const model = getActiveModel();
  if (!model.customFeatures.includes(value)) model.customFeatures.push(value);
  input.value = '';
  renderCustomFeatures(model);
}

function addColor() {
  const model = getActiveModel();
  model.colors.push({ id: createId(), nome: '', hex: '#ffffff' });
  renderColors(model);
}

function addPhotos(fileList) {
  const model = getActiveModel();
  const incoming = [...fileList].filter((file) => file instanceof File && ACCEPTED_PHOTO_TYPES.has(file.type));
  const remainingSlots = MAX_MODEL_PHOTOS - model.photos.length;
  model.photos.push(...incoming.slice(0, remainingSlots));

  if (incoming.length > remainingSlots) {
    setStatus('error', 'Cada modelo aceita no máximo 5 fotos.');
  }

  renderPhotos(model);
  renderModelList();
  renderProgress();
}

function serializeModel(model, index) {
  const selectedFeatures = DEFAULT_FEATURES.filter((feature) => model.features[feature]);
  return {
    index: index + 1,
    nome: cleanText(model.nome),
    categoria: model.categoria,
    cnh: model.cnh,
    emplacamento: model.emplacamento,
    observacaoLegal: cleanText(model.observacaoLegal),
    specs: {
      potencia: cleanText(model.potencia),
      velocidade: cleanText(model.velocidade),
      autonomia: cleanText(model.autonomia),
      bateria: cleanText(model.bateria),
      recarga: cleanText(model.recarga),
      carga: cleanText(model.carga),
      peso: cleanText(model.peso),
      valor: cleanText(model.valor),
    },
    listaTecnica: [...selectedFeatures, ...model.customFeatures.map(cleanText).filter(Boolean)],
    cores: model.colors.map((color) => ({ nome: cleanText(color.nome), hex: color.hex })).filter((color) => color.nome || color.hex),
    observacoes: cleanText(model.observacoes),
    totalFotos: model.photos.length,
    completo: isModelComplete(model),
  };
}

function getPhotoFieldName(modelIndex, photoIndex) {
  return `modelo_${String(modelIndex + 1).padStart(2, '0')}_foto_${String(photoIndex + 1).padStart(2, '0')}`;
}

function createCatalogPayload(catalogId, project) {
  const serializedModels = models.map((model, index) => ({
    ...serializeModel(model, index),
    fotoCampos: model.photos.map((_, photoIndex) => getPhotoFieldName(index, photoIndex)),
  }));

  return {
    catalogoId: catalogId,
    projeto: project,
    origem: 'old-lab-catalogo',
    totalModelos: models.length,
    totalFotos: serializedModels.reduce((total, model) => total + model.totalFotos, 0),
    paginaOrigem: window.location.href,
    userAgent: navigator.userAgent,
    enviadoEm: new Date().toISOString(),
    modelos: serializedModels,
  };
}

function formatCatalogSummary(catalog) {
  const modelBlocks = catalog.modelos.map((model) => {
    const specs = model.specs;
    const features = model.listaTecnica.length
      ? model.listaTecnica.map((feature) => `- ${feature}`).join('\n')
      : '- Nenhum item marcado';
    const colors = model.cores.length
      ? model.cores.map((color) => `- ${color.nome || 'Sem nome'}: ${color.hex}`).join('\n')
      : '- Nenhuma cor informada';
    const photos = model.fotoCampos.length
      ? model.fotoCampos.map((field) => `- ${field}`).join('\n')
      : '- Nenhuma foto anexada';

    return [
      `MODELO ${String(model.index).padStart(2, '0')} - ${model.nome || 'Sem nome'}`,
      `Categoria: ${model.categoria || '-'}`,
      `Precisa de CNH: ${model.cnh || '-'}`,
      `Precisa de emplacamento: ${model.emplacamento || '-'}`,
      `Observação legal: ${model.observacaoLegal || '-'}`,
      '',
      'Specs:',
      `- Potência: ${specs.potencia || '-'}`,
      `- Velocidade máxima: ${specs.velocidade || '-'}`,
      `- Autonomia: ${specs.autonomia || '-'}`,
      `- Bateria: ${specs.bateria || '-'}`,
      `- Tempo de recarga: ${specs.recarga || '-'}`,
      `- Carga máxima: ${specs.carga || '-'}`,
      `- Peso: ${specs.peso || '-'}`,
      `- Valor: ${specs.valor || '-'}`,
      '',
      'Lista técnica:',
      features,
      '',
      'Cores:',
      colors,
      '',
      'Fotos binárias:',
      photos,
      '',
      `Observações: ${model.observacoes || '-'}`,
    ].join('\n');
  });

  return [
    'OLD LAB - CATÁLOGO RECEBIDO',
    '',
    `Projeto: ${catalog.projeto}`,
    `Catálogo ID: ${catalog.catalogoId}`,
    `Total de modelos: ${catalog.totalModelos}`,
    `Total de fotos: ${catalog.totalFotos}`,
    `Enviado em: ${catalog.enviadoEm}`,
    `Origem: ${catalog.paginaOrigem}`,
    '',
    ...modelBlocks.flatMap((block, index) => [block, index < modelBlocks.length - 1 ? '\n---\n' : '']),
  ].join('\n');
}

function validateCatalog() {
  const invalid = models.filter((model) => !cleanText(model.nome));
  if (invalid.length) {
    setStatus('error', 'Todos os modelos precisam ter pelo menos um nome.');
    activeModelId = invalid[0].id;
    renderEditor();
    return false;
  }

  return true;
}

async function sendCatalogToWebhook(catalogId, project) {
  const catalog = createCatalogPayload(catalogId, project);
  const formData = new FormData();
  const photoFields = [];

  formData.set('origem', catalog.origem);
  formData.set('tipoPacote', 'catalogo-modelos');
  formData.set('formatoPayload', 'multipart-json-binarios');
  formData.set('catalogoId', catalogId);
  formData.set('projeto', project);
  formData.set('totalModelos', String(catalog.totalModelos));
  formData.set('totalFotos', String(catalog.totalFotos));
  formData.set('catalogo', JSON.stringify(catalog));
  formData.set('resumoTexto', formatCatalogSummary(catalog));
  formData.set('paginaOrigem', catalog.paginaOrigem);
  formData.set('userAgent', catalog.userAgent);
  formData.set('enviadoEm', catalog.enviadoEm);

  models.forEach((model, modelIndex) => {
    model.photos.forEach((file, photoIndex) => {
      const fieldName = getPhotoFieldName(modelIndex, photoIndex);
      photoFields.push({
        campo: fieldName,
        modeloIndex: modelIndex + 1,
        modeloNome: cleanText(model.nome),
        fotoIndex: photoIndex + 1,
        arquivoOriginal: file.name,
      });
      formData.append(fieldName, file, file.name);
    });
  });
  formData.set('fotoCampos', JSON.stringify(photoFields));
  formData.set('binarios', photoFields.map((photo) => photo.campo).join(','));

  const response = await fetch(webhookUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Webhook respondeu com status ${response.status}`);
  }

  return catalog;
}

function setupProjectIdentifier() {
  const project = getProjectFromUrl();
  if (!project) return;

  projectInput.value = project;
  projectNames.forEach((item) => {
    item.textContent = project;
  });
  projectBadges.forEach((badge) => {
    badge.hidden = false;
  });
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
    const actionElement = document.elementFromPoint(event.clientX, event.clientY)?.closest('a, button, label, input, textarea, select');
    cursor.classList.toggle('is-action', Boolean(actionElement));
  });
}

document.addEventListener('click', (event) => {
  const target = event.target.closest('button');
  if (!target) return;

  if (target.matches('[data-add-model]')) addModel();
  if (target.matches('[data-duplicate-model]')) duplicateActiveModel();
  if (target.matches('[data-remove-model]')) removeActiveModel();
  if (target.matches('[data-select-model]')) {
    activeModelId = target.dataset.selectModel;
    renderEditor();
  }
  if (target.matches('[data-add-feature]')) addCustomFeature();
  if (target.matches('[data-remove-feature]')) {
    const model = getActiveModel();
    model.customFeatures.splice(Number(target.dataset.removeFeature), 1);
    renderCustomFeatures(model);
  }
  if (target.matches('[data-add-color]')) addColor();
  if (target.matches('[data-remove-color]')) {
    const model = getActiveModel();
    if (model.colors.length === 1) {
      setStatus('error', 'Mantenha pelo menos uma cor no modelo.');
      return;
    }
    model.colors = model.colors.filter((color) => color.id !== target.dataset.removeColor);
    renderColors(model);
  }
  if (target.matches('[data-remove-photo]')) {
    const model = getActiveModel();
    model.photos.splice(Number(target.dataset.removePhoto), 1);
    renderPhotos(model);
    renderModelList();
    renderProgress();
  }
});

form.addEventListener('input', (event) => {
  const target = event.target;
  if (target.matches('[data-field]')) syncActiveField(target);
  if (target.matches('[data-feature]')) {
    getActiveModel().features[target.dataset.feature] = target.checked;
  }
  if (target.matches('[data-color-name]')) {
    const color = getActiveModel().colors.find((item) => item.id === target.dataset.colorName);
    if (color) color.nome = target.value;
  }
  if (target.matches('[data-color-hex]')) {
    const color = getActiveModel().colors.find((item) => item.id === target.dataset.colorHex);
    if (color) color.hex = target.value;
  }
});

form.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches('[data-photo-input]')) {
    addPhotos(target.files || []);
    target.value = '';
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!validateCatalog()) return;

  const catalogId = createId();
  const project = cleanProjectName(projectInput.value) || 'Projeto sem nome';
  const payload = createCatalogPayload(catalogId, project);

  if (!webhookUrl) {
    sessionStorage.setItem('oldLabCatalogDraft', JSON.stringify(payload));
    setStatus('pending', 'Catálogo validado e salvo neste navegador. Falta configurar a webhook do N8N para envio automático.');
    return;
  }

  submitButton.disabled = true;
  submitButton.firstChild.textContent = 'Enviando ';
  setStatus('pending', 'Enviando catálogo completo para a Old Lab...');

  try {
    await sendCatalogToWebhook(catalogId, project);
    setStatus('success', 'Catálogo enviado com sucesso. A Old Lab recebeu todos os modelos e fotos.');
  } catch (error) {
    setStatus('error', `Não foi possível enviar agora: ${error.message}`);
  } finally {
    submitButton.disabled = false;
    submitButton.firstChild.textContent = 'Enviar catálogo para Old Lab ';
  }
});

setupProjectIdentifier();
activeModelId = models[0].id;
renderEditor();
setupCursor();
