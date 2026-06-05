# Nhat Ky Hoc Tap BataVasa

File nay dung de ghi lai qua trinh hoc cach viet, sua, va phat trien app BataVasa. Moi khi hoc mot phan moi, hay them ghi chu vao muc "Nhat ky hoc tap".

## Muc Tieu

- Hieu app BataVasa dang duoc viet bang cong nghe gi.
- Biet cach chay app tren may.
- Biet cach doc cau truc source code.
- Biet cach sua mot man hinh, mot component, mot service, va mot test.
- Biet cach ghi lai viec da hoc de lan sau tiep tuc nhanh hon.

## Cach Hoc Voi File Nay

1. Doc muc "Lo trinh hoc" de biet nen hoc theo thu tu nao.
2. Moi khi lam mot viec moi, ghi lai ngay, muc tieu, file da sua, loi gap phai, va cach giai quyet.
3. Neu gap cho khong hieu, hoi lai ngay bang cach noi ro file hoac khái niem dang bi vuong.
4. Sau moi task nho, chay test hoac chay app de kiem tra lai.

## Lo Trinh Hoc

### Buoi 1: Hieu Tong Quan App

Can nam:

- App nay la ung dung Expo / React Native.
- Source man hinh nam chu yeu trong `app/`.
- Component dung lai nam trong `components/`.
- Logic nghiep vu nam trong `services/`, `features/`, `store/`, va `database/`.
- Tai lieu hien co nam trong `docs/`.

Viec can lam:

1. Mo `package.json` de xem cac lenh co san.
2. Mo `app.json` de xem cau hinh app.
3. Mo `docs/current-state.md` de doc trang thai hien tai cua san pham.
4. Mo thu muc `app/` de xem app co nhung man hinh nao.

Ket qua can dat:

- Biet app chay bang lenh nao.
- Biet file nao la cau hinh app.
- Biet nen tim man hinh va logic o dau.

### Buoi 2: Chay App

Can nam:

- Expo dung de chay app trong moi truong phat trien.
- Khi sua UI, nen chay app de nhin ket qua.
- Khi sua logic, nen chay test neu co.

Viec can lam:

1. Chay `npm install` neu may chua co dependencies.
2. Chay `npx expo start`.
3. Mo app bang Expo Go hoac emulator.
4. Ghi lai loi neu app khong chay.

Ket qua can dat:

- App hien len duoc tren thiet bi hoac emulator.
- Biet doc loi co ban trong terminal.

### Buoi 3: Doc Mot Man Hinh

Can nam:

- Mot man hinh thuong gom UI, state, handler, va goi service.
- UI nen tach thanh component khi bi lap lai hoac qua dai.

Viec can lam:

1. Chon mot man hinh trong `app/`.
2. Tim cac component man hinh do dang import.
3. Tim service hoac store ma man hinh do dang dung.
4. Ghi lai dong nao minh chua hieu.

Ket qua can dat:

- Biet mot man hinh lay du lieu tu dau.
- Biet nut bam tren man hinh goi ham nao.

### Buoi 4: Sua UI Nho

Can nam:

- Sua UI nen bat dau bang thay doi nho, de kiem tra nhanh.
- Can giu style dong nhat voi design system hien co.

Viec can lam:

1. Chon mot text, icon, spacing, hoac button can sua.
2. Tim file dang render UI do.
3. Sua mot thay doi nho.
4. Chay app va kiem tra lai tren man hinh.

Ket qua can dat:

- Biet cach sua UI ma khong lam vo logic.
- Biet cach tim dung file can sua.

### Buoi 5: Sua Logic Nho

Can nam:

- Logic nghiep vu nen nam trong `services/`, `features/`, `store/`, hoac `database/`, tuy theo pattern hien co.
- Khong nen nhét qua nhieu logic vao component UI.

Viec can lam:

1. Chon mot hanh vi nho can sua.
2. Tim service hoac function lien quan.
3. Sua logic.
4. Chay test lien quan neu co.
5. Neu chua co test, ghi lai can bo sung test nao.

Ket qua can dat:

- Biet cach sua mot hanh vi cua app.
- Biet khi nao can them hoac sua test.

### Buoi 6: Lam Mot Feature Nho Tu Dau Den Cuoi

Can nam:

- Mot feature co the gom UI, state, database, service, i18n, va test.
- Nen chia feature thanh nhieu buoc nho.

Viec can lam:

1. Viet yeu cau feature bang 2-3 cau.
2. Xac dinh file nao can sua.
3. Sua tung phan nho.
4. Chay app.
5. Chay test.
6. Cap nhat tai lieu neu feature anh huong den cach dung app.

Ket qua can dat:

- Hieu quy trinh viet mot tinh nang that.
- Biet cach kiem tra lai truoc khi commit.

## Checklist Khi Viet App

Truoc khi sua code:

- Doc file lien quan truoc.
- Tim pattern da co trong codebase.
- Xac dinh thay doi nho nhat de dat muc tieu.

Khi sua code:

- Sua dung noi, tranh refactor ngoai pham vi.
- Dat ten bien va ham ro nghia.
- Giu UI dong nhat voi app.
- Khong xoa code khi chua hieu no dung de lam gi.

Sau khi sua code:

- Chay app neu sua UI hoac flow nguoi dung.
- Chay test neu sua logic.
- Ghi lai loi da gap va cach sua.
- Cap nhat file hoc tap nay.

## Mau Ghi Nhat Ky Hoc Tap

Copy mau nay xuong cuoi file moi khi hoc xong mot buoi.

```md
### YYYY-MM-DD - Ten buoi hoc

Muc tieu:

- 

Da lam:

- 

File da doc/sua:

- 

Dieu da hieu:

- 

Dieu chua hieu:

- 

Loi gap phai:

- 

Cach xu ly:

- 

Viec tiep theo:

- 
```

## Nhat Ky Hoc Tap

### 2026-05-31 - Tao file nhat ky hoc app

Muc tieu:

- Tao mot noi de ghi lai qua trinh hoc cach viet app BataVasa.
- Co lo trinh hoc tung buoc, de khi khong hieu co the hoi tiep.

Da lam:

- Tao file `docs/learning-journal.md`.
- Viet lo trinh hoc tu tong quan app, chay app, doc man hinh, sua UI, sua logic, den lam feature nho.

File da doc/sua:

- `docs/learning-journal.md`

Dieu da hieu:

- Qua trinh hoc se duoc ghi lai tai file nay.

Dieu chua hieu:

- Chua co.

Viec tiep theo:

- Doc `package.json`, `app.json`, va `docs/current-state.md`.
- Sau do bat dau Buoi 1: Hieu Tong Quan App.

### 2026-05-31 - Buoi 1: Hieu scripts va cau truc app

Muc tieu:

- Hieu `scripts` trong `package.json` dung de lam gi.
- Bat dau hieu app React Native / Expo duoc chia thanh cac file va thu muc nhu the nao.

Da lam:

- Doc phan `scripts` trong `package.json`.
- Hieu cac lenh co ban: `npm start`, `npm run web`, `npm test`.
- Kiem tra thu muc `app/` va `features/`.

File da doc/sua:

- `package.json`
- `app.json`
- `docs/learning-journal.md`

Dieu da hieu:

- `npm start` la lenh quan trong nhat luc moi hoc vi no dung de chay app.
- Thu muc `app/` chua cac file route/trang cua app.
- Thu muc `features/` chua code tinh nang that su cua tung phan nhu finance, habits, journals, settings.

Dieu chua hieu:

- Chua can hieu het tung file ngay.
- Can hoc tiep cach mot file trong `app/` tro den mot man hinh trong `features/`.

Viec tiep theo:

- Hoc cach doc mot route don gian, vi du `app/finance.tsx`.
- Tu route do lan sang man hinh that trong `features/finance/screens/`.

### 2026-06-01 - Buoi 2: Doc import va type cua man hinh Finance

Muc tieu:

- Hieu phan dau cua `TransactionListScreen.tsx`.
- Biet import la gi va type dung de lam gi.

Da lam:

- Doc cac import trong `features/finance/screens/TransactionListScreen.tsx`.
- Nhan dien cac nhom import: React Native UI, navigation, state, ngay thang, hooks, components, design, i18n, settings, FX, type.

File da doc/sua:

- `app/finance.tsx`
- `features/finance/screens/TransactionListScreen.tsx`
- `docs/learning-journal.md`

Dieu da hieu:

- `app/finance.tsx` la cua vao cua trang Finance.
- `TransactionListScreen.tsx` la man hinh that su cua danh sach giao dich.
- Phan dau file thuong gom import va khai bao type.

Dieu chua hieu:

- Chua can hieu toan bo logic tinh tong tien, loc ky, hay recurring transaction ngay luc nay.

Viec tiep theo:

- Doc tiep phan function `TransactionListScreen`.
- Tim cac dong `useState`, `useMemo`, `useEffect`, va phan `return`.
