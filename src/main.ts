import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useSyncStore } from './stores/sync'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Stores need the active Pinia instance, so the engine starts after app.use().
useSyncStore().start()

app.mount('#app')
