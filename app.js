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

// ===== 画面の部品 =====
const $ = (id) => document.getElementById(id);
const addForm = $('add-form');
const addInput = $('add-input');
const favList = $('fav-list');
const favEmpty = $('fav-empty');
const favForm = $('fav-form');
const favInput = $('fav-input');
const favEditToggle = $('fav-edit-toggle');
const itemList = $('item-list');
const listEmpty = $('list-empty');
const clearChecked = $('clear-checked');
const toast = $('toast');

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
    state.items.push({ id: newId(), name, checked: false });
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

function deleteItem(id) {
  state.items = state.items.filter((i) => i.id !== id);
  save();
  render();
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
  // よく買うもの
  favList.replaceChildren();
  for (const name of state.favorites) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fav-chip' + (editingFavorites ? ' editing' : '');
    btn.textContent = name;
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
  favEditToggle.textContent = editingFavorites ? '完了' : '編集';

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
function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
}

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

render();

// ===== 電波がなくても使えるようにする（留守番係の登録） =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
