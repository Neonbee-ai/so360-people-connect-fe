// @ts-nocheck
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig({
    base: 'http://localhost:3014/',
    plugins: [
        react({
            jsxRuntime: 'automatic',
        }),
        federation({
            name: 'people_connect_app',
            filename: 'remoteEntry.js',
            exposes: {
                './App': './src/App.tsx',
            },
            shared: {
                react: { singleton: true, requiredVersion: '^19.2.0' },
                'react-dom': { singleton: true, requiredVersion: '^19.2.0' },
                'react-router-dom': { singleton: true, requiredVersion: '^7.12.0' },
                'framer-motion': { singleton: true },
                'lucide-react': { singleton: true },
                '@so360/shell-context': { singleton: true },
                '@so360/design-system': { singleton: true },
                '@so360/event-bus': { singleton: true },
            },
        }),
    ],
    build: {
        target: 'esnext',
        minify: false,
        cssCodeSplit: false,
    },
    server: {
        port: 3014,
        cors: true,
        proxy: {
            '/people-api': {
                target: 'http://localhost:3013',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/people-api/, ''),
            },
            '/core-api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/core-api/, ''),
            },
            '/v1': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    preview: {
        port: 3014,
        cors: true,
        proxy: {
            '/people-api': {
                target: 'http://localhost:3013',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/people-api/, ''),
            },
            '/core-api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: (path) => path.replace(/^\/core-api/, ''),
            },
            '/v1': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
});
