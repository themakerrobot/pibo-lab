// ═══════════════════════════════════════════════════════════
// CF STORE — 분류툴에서 학습한 모델을 브라우저에 보관한다
// ═══════════════════════════════════════════════════════════
// 분류툴(classify.html)에서 저장하고, 개발툴의 vision_load_cf 블록이 꺼내 쓴다.
// 두 페이지가 같은 오리진이면 그대로 이어진다 (exe: localhost:50030, 웹: 배포 도메인).
//
// 보관 형식은 실물로 내보내는 zip 과 같은 내용이다.
//   { name, labels: [...], topology: {...}, specs: [...], weights: ArrayBuffer, savedAt }
// 실물 파이보로 옮길 때는 분류툴의 [내보내기] 로 zip 을 받아
// tfjs_to_keras.py 로 변환해 쓰면 된다.
//
// localStorage 는 5MB 제한에 문자열만 담기므로 가중치를 넣기에 부족하다. IndexedDB 를 쓴다.

const CfStore = (function () {
  const DB = 'pibo-lab', STORE = 'models', VER = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      const rq = indexedDB.open(DB, VER);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'name' });
      };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }

  function tx(mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(STORE, mode);
      const rq = fn(t.objectStore(STORE));
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    }));
  }

  return {
    // name 은 블록에서 적을 이름. 실물 경로의 파일명과 맞춰두면 옮길 때 헷갈리지 않는다.
    save(name, rec) {
      const key = String(name || '').trim();
      if (!key) return Promise.reject(new Error('no name'));
      return tx('readwrite', s => s.put(Object.assign({}, rec, { name: key, savedAt: Date.now() })));
    },
    load(name) { return tx('readonly', s => s.get(String(name || '').trim())); },
    remove(name) { return tx('readwrite', s => s.delete(String(name || '').trim())); },
    list() { return tx('readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => y.savedAt - x.savedAt)); },
  };
})();
