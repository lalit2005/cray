# cray: a local-first, privacy-focused chat app

cray is a chat application designed with a local-first approach, prioritizing user privacy, offline capability, and seamless sync. unlike traditional chat apps that rely solely on cloud storage and constant connectivity, cray ensures your data is always available on your device and only syncs with the server when needed.

## what makes cray different?

- **local-first architecture**: all your chats and messages are stored in your browser's indexeddb using dexie. this means you can access your data instantly, even when offline. changes are synced to the server only when you have connectivity.
- **privacy by default**: your data stays on your device. only the minimal required data is sent to the server for backup and cross-device sync. you control your information.
- **bring your own backend**: cray is designed to be backend-agnostic. you can self-host the backend or use the provided server. the backend uses postgres for storage and exposes simple sync endpoints.
- **open and extensible**: built with remix in spa mode and tailwind css, cray is easy to customize and extend for your own needs.

## how it works

- each user record in the backend postgres has an `updatedat` column to track the last update to chats and messages.
- the client stores a `lastsyncedat` timestamp in the local keyval table.
- when syncing, the client sends records updated or created after `lastsyncedat` to the server, along with their ids and the timestamp.
- the server fetches records that match those ids or were updated after `lastsyncedat`, determines the most recent version, and sends them back.
- the client upserts these records into indexeddb and updates `lastsyncedat`.
- if there are no local changes, the client can fetch only new records from the server since the last sync.
- all sync operations are designed to be conflict-aware and merge the latest changes.

## hosting and deployment

- cray can be deployed as a static site using any http server that supports spa fallback (serving all routes from `/index.html`).
- the backend can be self-hosted or run on any platform supporting node.js and postgres.
- you can preview the production build locally using `vite preview`.
- for a simple static server, you can use `sirv-cli` as shown below:

```shell
npx sirv-cli build/client/ --single
```

## development

- run `npm run dev` to start the app in development mode.
- run `npm run build` to generate the production build.
- run `npm run preview` to preview the build locally.

## styling

cray uses tailwind css for styling by default, but you can use any css framework you prefer. see the vite docs for more information on css support.

## future plans

- **end-to-end encryption**: ensure that even the server cannot read your messages.
- **p2p sync**: enable direct device-to-device sync without a central server.
- **mobile app**: provide a native-like experience on mobile devices.
- **plugin system**: allow users to extend cray with custom features and integrations.
- **group chat and media sharing**: support for richer chat experiences.
- **federation**: connect with other cray servers for a decentralized network.

## contributing

contributions are welcome! feel free to open issues or submit pull requests to help improve cray.

---

for more details on the architecture and sync logic, see the code in `app/lib/sync.ts` and the backend implementation in `backend/src/lib/sync.ts`.
