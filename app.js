// ===== 保存まわり（スマホの中に保存する） =====
const STORAGE_KEY = 'shopping-list-v1';

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (data && Array.isArray(data.items) && Array.isArray(data.favorites)) return data;
  } catch (e) { /* 読めなかったときは空から始める */ }
  return { items: [], favorites: [] };
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    showToast('保存できませんでした');
  }
}

let state = load();
let editingFavorites = false;

// 「よく買うもの」の引き出しを開いているかどうか（最初は閉じておく）
const UI_KEY = 'shopping-list-ui';
function loadFavOpen() {
  try { return localStorage.getItem(UI_KEY) === 'fav-open'; } catch (e) { return false; }
}
function saveFavOpen(open) {
  try { localStorage.setItem(UI_KEY, open ? 'fav-open' : 'fav-closed'); } catch (e) { /* 保存できなくても動く */ }
}

// ===== 画面の部品 =====
const $ = (id) => document.getElementById(id);
const addForm = $('add-form');
const addInput = $('add-input');
const favDetails = $('fav-details');
const favEditNote = $('fav-edit-note');
const favList = $('fav-list');
const favEmpty = $('fav-empty');
const favForm = $('fav-form');
const favInput = $('fav-input');
const favEditToggle = $('fav-edit-toggle');
const listTitle = $('list-title');
const itemList = $('item-list');
const listEmpty = $('list-empty');
const clearChecked = $('clear-checked');
const toast = $('toast');
const toastText = $('toast-text');
const toastAction = $('toast-action');

// ===== 操作 =====
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// リストに追加（同じ名前がすでにあれば二重に追加しない）
function addItem(rawName) {
  const name = rawName.trim();
  if (!name) return;
  const existing = state.items.find((i) => i.name === name);
  if (existing) {
    if (existing.checked) {
      existing.checked = false;
      showToast(`「${name}」を買うものに戻しました`);
    } else {
      showToast(`「${name}」はもう入っています`);
    }
  } else {
    // まだ買っていないものの一番下（チェック済みより上）に入れる
    const item = { id: newId(), name, checked: false };
    const firstChecked = state.items.findIndex((i) => i.checked);
    if (firstChecked === -1) state.items.push(item);
    else state.items.splice(firstChecked, 0, item);
    showToast(`「${name}」を追加しました`);
  }
  save();
  render();
}

function toggleItem(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  item.checked = !item.checked;
  // チェックしたものは一番下へ移動する
  state.items = state.items.filter((i) => i.id !== id);
  if (item.checked) {
    state.items.push(item);
  } else {
    const firstChecked = state.items.findIndex((i) => i.checked);
    if (firstChecked === -1) state.items.push(item);
    else state.items.splice(firstChecked, 0, item);
  }
  save();
  render();
}

// 消したあと、しばらくは「元に戻す」で戻せる
function deleteItem(id) {
  const index = state.items.findIndex((i) => i.id === id);
  if (index === -1) return;
  const [removed] = state.items.splice(index, 1);
  save();
  render();
  showToast(`「${removed.name}」を消しました`, {
    actionLabel: '元に戻す',
    duration: 5000,
    onAction: () => {
      if (state.items.some((i) => i.name === removed.name)) return;
      state.items.splice(Math.min(index, state.items.length), 0, removed);
      save();
      render();
    },
  });
}

function clearCheckedItems() {
  const count = state.items.filter((i) => i.checked).length;
  if (!count) return;
  if (!confirm(`チェック済みの ${count} 件を消しますか？`)) return;
  state.items = state.items.filter((i) => !i.checked);
  save();
  render();
}

function addFavorite(rawName) {
  const name = rawName.trim();
  if (!name) return;
  if (state.favorites.includes(name)) {
    showToast(`「${name}」はもう登録されています`);
    return;
  }
  state.favorites.push(name);
  save();
  render();
}

function removeFavorite(name) {
  state.favorites = state.favorites.filter((f) => f !== name);
  save();
  render();
}

// ===== 画面を描く =====
function render() {
  // よく買うもの（リストに入っている＝まだ買っていないものは緑で塗る）
  const waiting = new Set(state.items.filter((i) => !i.checked).map((i) => i.name));
  favList.replaceChildren();
  for (const name of state.favorites) {
    const btn = document.createElement('button');
    btn.type = 'button';
    const inList = !editingFavorites && waiting.has(name);
    btn.className = 'fav-chip' + (editingFavorites ? ' editing' : '') + (inList ? ' in-list' : '');
    btn.textContent = inList ? `✓ ${name}` : name;
    if (editingFavorites) {
      const x = document.createElement('span');
      x.className = 'x';
      x.textContent = '×';
      btn.append(x);
      btn.setAttribute('aria-label', `${name} を登録から外す`);
      btn.addEventListener('click', () => removeFavorite(name));
    } else {
      btn.setAttribute('aria-label', `${name} をリストに追加`);
      btn.addEventListener('click', () => addItem(name));
    }
    favList.append(btn);
  }
  favEmpty.hidden = state.favorites.length > 0 || editingFavorites;
  favForm.hidden = !editingFavorites;
  favEditNote.hidden = !editingFavorites;
  favDetails.classList.toggle('editing', editingFavorites);
  favEditToggle.textContent = editingFavorites ? '完了' : '編集';
  favEditToggle.classList.toggle('done', editingFavorites);

  // 「あと何個？」
  const remaining = state.items.filter((i) => !i.checked).length;
  if (state.items.length === 0) listTitle.textContent = 'リスト';
  else if (remaining === 0) listTitle.textContent = 'リスト（ぜんぶ買えました！）';
  else listTitle.textContent = `リスト（あと${remaining}つ）`;

  // リスト（買っていないもの → チェック済みの順）
  const ordered = [
    ...state.items.filter((i) => !i.checked),
    ...state.items.filter((i) => i.checked),
  ];
  itemList.replaceChildren();
  for (const item of ordered) {
    const li = document.createElement('li');
    li.className = 'item' + (item.checked ? ' checked' : '');

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'item-main';
    main.setAttribute('aria-pressed', String(item.checked));
    const check = document.createElement('span');
    check.className = 'check';
    check.textContent = item.checked ? '✓' : '';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = item.name;
    main.append(check, name);
    main.addEventListener('click', () => toggleItem(item.id));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'btn-delete';
    del.textContent = '✕';
    del.setAttribute('aria-label', `${item.name} を消す`);
    del.addEventListener('click', () => deleteItem(item.id));

    li.append(main, del);
    itemList.append(li);
  }
  listEmpty.hidden = state.items.length > 0;
  clearChecked.hidden = !state.items.some((i) => i.checked);
}

// ===== お知らせ =====
let toastTimer;
let toastOnAction = null;
function hideToast() {
  toast.classList.remove('show');
  toastOnAction = null;
}
function showToast(message, { actionLabel, onAction, duration = 2000 } = {}) {
  toastText.textContent = message;
  toastOnAction = onAction || null;
  toastAction.hidden = !onAction;
  if (actionLabel) toastAction.textContent = actionLabel;
  toast.classList.toggle('has-action', !!onAction);
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, duration);
}
toastAction.addEventListener('click', () => {
  const action = toastOnAction;
  clearTimeout(toastTimer);
  hideToast();
  if (action) action();
});

// ===== ボタンなどの設定 =====
addForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addItem(addInput.value);
  addInput.value = '';
});

favForm.addEventListener('submit', (e) => {
  e.preventDefault();
  addFavorite(favInput.value);
  favInput.value = '';
  favInput.focus();
});

favEditToggle.addEventListener('click', () => {
  editingFavorites = !editingFavorites;
  render();
  if (editingFavorites) favInput.focus();
});

clearChecked.addEventListener('click', clearCheckedItems);

favDetails.open = loadFavOpen();
favDetails.addEventListener('toggle', () => {
  saveFavOpen(favDetails.open);
  // 引き出しを閉じたら編集も終わりにする（押し間違いで登録が消えないように）
  if (!favDetails.open && editingFavorites) {
    editingFavorites = false;
    render();
  }
});

render();

// ===== 電波がなくても使えるようにする（留守番係の登録） =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
