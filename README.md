# Приглашение Арины

Статическая страница для GitHub Pages. Основной файл — `index.html`, локальные библиотеки — `js/`, фотографии — `img/`. RSVP предлагает написать Арине во ВК; ответы гостей отдельно не сохраняются.

Бронь работает через Firebase Realtime Database проекта `arina18`: публичные статусы `taken/g1..g8` и закрытые ключи `keys/g1..g8`. Ключ гостя сохраняется в его браузере. Правила в `firebase/database.rules.json` разрешают безопасный повтор того же запроса и запрещают смену владельца и раздельную запись пары.

## Проверка правил

Нужны Node.js, Java 21 и Firebase CLI. Из корня проекта:

```text
npm exec --yes --package firebase-tools -- firebase emulators:exec "node firebase/test-rules.cjs" --only database --project demo-arina18-rules
```

Проверка использует локальный эмулятор, тестовый namespace и синтетические ключи. Генератор `node firebase/build-rules.cjs` восстанавливает файл правил; после изменения нужен повтор эмулятора.

## Публикация

Сначала проверь и опубликуй правила базы, затем обновляй страницу. Новому клиенту нужен безопасный повтор `PATCH` и `PUT` с сохранённым ключом гостя.

```text
npm exec --yes --package firebase-tools -- firebase database:set /.settings/rules firebase/database.rules.json --project arina18 --force
npm exec --yes --package firebase-tools -- firebase database:get /.settings/rules --project arina18
```

После записи сверь полученные правила с файлом. Страница публикуется из `main` средствами GitHub Pages. Проверяй опубликованный адрес, включая реальную бронь и её отмену; тестовые брони после проверки нужно снять.
