# Contexto: invitación web Zequelly & Elio

## Objetivo
Crear una landing/invitación digital de boda para **Zequelly & Elio**: elegante, romántica, moderna, premium y funcional para gestionar invitados, RSVP, ubicación, regalos, música y detalles importantes.

## Estilo
- Sensación: romántica, elegante, sofisticada, cálida, íntima, ceremonial, floral/botánica, boda nocturna/jardín elegante.
- Paleta: `#0C1D0E` verde noche, `#154D35` esmeralda, `#837E5E` dorado antiguo, `#A39F88` champagne, `#F7F3EA` marfil, `#E2E5E2` blanco floral.
- Proporción visual: 70% verde profundo/marfil, 20% esmeralda, 10% dorado.
- Tipos: serif elegante para títulos; script para nombres/detalles románticos; sans limpia para texto funcional.
- Evitar: estética SaaS, colores chillones, infantil, exceso de animación, formularios fríos, lenguaje técnico visible.

## Voz
- Tono: romántico, elegante, cercano, ceremonial.
- Usar: “Nos encantaría contar contigo”, “Celebra con nosotros”, “Confirma tu asistencia”, “Guarda esta fecha”, “Una noche especial”, “Con mucho amor”, “Tu presencia es el mejor regalo”, “Gracias por ser parte de nuestra historia”.
- Evitar: usuario, registro, evento, datos obligatorios, pago, formulario enviado, proceso completado.

## Stack
- Frontend: Next.js App Router, TypeScript, Tailwind CSS, Framer Motion, React Hook Form, Zod.
- Backend: Server Actions o API Routes.
- DB: Supabase PostgreSQL.
- Hosting: Vercel.
- Opcional: Resend para emails, MercadoPago Checkout Pro para regalo.
- Música: audio local en loop tras interacción + embed Spotify.
- Mapas: botones Google Maps/Waze.

## UX clave
- Mobile first, vertical, premium, buen contraste, botones grandes, formularios simples.
- RSVP en menos de 30s, sin pedir datos innecesarios.
- Cards translúcidas o marfil sobre verde; detalles dorados en líneas, íconos, bordes y separadores.
- Ornamentos botánicos sutiles. Admin más funcional pero limpio.
- Estados de carga/error con mensajes humanos y elegantes.

## Música
- No autoplay con sonido al cargar.
- Flujo: portada/sobre -> botón “Entrar a la invitación” -> activar música en loop -> mostrar control flotante reproducir/pausar.

## Secciones landing
1. **Portada**: “Zequelly & Elio”, “Nos casamos”, “Con mucha alegría queremos invitarte a celebrar el inicio de nuestra nueva historia juntos.”, “Sábado, [día] de [mes] de [año]”, botón “Entrar a la invitación”. Al entrar: música + landing + animación suave.
2. **Hero**: título “Una historia que comienza para siempre”; copy sobre celebrar el amor con seres queridos; firma “Con amor,\nZequelly & Elio”.
3. **Cuenta regresiva**: “Falta muy poco para nuestro gran día”; copy “Cada día nos acerca más al momento en que diremos ‘sí’ y celebraremos junto a ustedes.”; días/horas/minutos/segundos.
4. **Detalles**: cards Ceremonia, Celebración, Dress code. Configurable: lugar, hora, dirección. Dress code: “Elegante formal”; tonos sugeridos verde/dorado/negro/nude/neutros. Nota de llegar con anticipación.
5. **RSVP**: “Confirma tu asistencia”; copy con fecha límite; botón “Confirmar asistencia”.
6. **Ubicación**: “Cómo llegar”; copy “Para que llegues sin complicaciones, te dejamos la ubicación exacta del lugar.”; botones Google Maps/Waze configurables.
7. **Información importante**: botón/card abre modal.
8. **Regalo**: “Lluvia de amor”; transferencia + MercadoPago opcional.
9. **Playlist**: “La música de nuestra historia”; embed Spotify + link externo.
10. **Cierre**: “Gracias por ser parte de nuestra historia”; copy sobre momentos que se recuerdan para siempre; firma.

## RSVP por invitado
- URL: `/boda/[codigo]` o `/invitado/[code]`.
- Al entrar: “Hola, [Nombre]”; “Tenemos reservado [número] cupo(s) para ti.”
- Puede: confirmar, declinar, elegir cantidad dentro del cupo, indicar restricciones alimentarias, dejar mensaje.
- Estados: `pending`, `confirmed`, `declined`.
- Mensaje confirmado: “Gracias por confirmar. Nos alegra mucho saber que serás parte de este día tan especial.”
- Mensaje declinado: “Gracias por avisarnos. Aunque nos habría encantado verte, agradecemos mucho tu cariño y buenos deseos.”
- Reglas: evitar duplicados, no superar cupo, guardar actualización.

## Modales
- **Información importante**: título “Antes de acompañarnos”; texto “Con mucho cariño queremos compartir algunos detalles para que todos podamos disfrutar de una noche especial:”; lista: llegar 15 min antes, confirmar antes de fecha límite, respetar dress code, evitar publicar fotos/videos antes que los novios si aplica, escribir ante dudas; botón “Entendido”.
- **Transferencia**: nombre, banco, tipo cuenta, número cuenta, RUT, correo; botón “Copiar datos”.
- **MercadoPago**: crear preferencia desde backend, no exponer tokens, ruta segura, desactivable si no se configura.

## Admin
- Ruta `/admin`, protegido con `ADMIN_PASSWORD` o Supabase Auth.
- Mostrar: total invitados, confirmados, pendientes, no asistirán, total asistentes confirmados, restricciones alimentarias, mensajes, filtro por grupo/familia, exportar CSV/Excel.

## Base de datos
```sql
guests(id, code, full_name, group_name, max_companions, status, confirmed_count, food_restrictions, message, created_at, updated_at)
settings(id, wedding_date, rsvp_deadline, ceremony_place, ceremony_time, ceremony_address, party_place, party_time, party_address, google_maps_url, waze_url, spotify_playlist_url, main_song_url, bank_holder_name, bank_name, bank_account_type, bank_account_number, bank_rut, bank_email, mercadopago_enabled, mercadopago_public_url, created_at, updated_at)
gifts(id, guest_id, method, amount, status, created_at) -- opcional
```

## Estructura sugerida
```txt
/app/(public)/page.tsx
/app/(public)/invitado/[code]/page.tsx
/app/admin/page.tsx
/app/api/rsvp/route.ts
/app/api/gift/mercadopago/route.ts
/components/{IntroScreen,Hero,Countdown,WeddingDetails,RSVPForm,MapButtons,InfoPopup,GiftModal,SpotifyPlaylist,MusicPlayer,Footer,AdminDashboard}.tsx
/lib/{supabase,guests,settings,mercadopago,validations,utils}.ts
/styles/globals.css
```

## Env
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_PASSWORD=
NEXT_PUBLIC_SITE_URL=
MERCADOPAGO_ACCESS_TOKEN=
NEXT_PUBLIC_MERCADOPAGO_ENABLED=
RESEND_API_KEY=
```

## Requisitos técnicos
- No exponer claves privadas. Usar env vars.
- Validar formularios con Zod.
- Proteger admin.
- Código limpio, modular, mantenible, componentes reutilizables.
- Preparado para producción en Vercel.

## Criterios de aceptación
Landing responsive/elegante; portada con entrada; música loop tras interacción; countdown; RSVP por código; validación de cupos; guardado en Supabase; Google Maps/Waze; popup info; modal regalo/copiar datos; MercadoPago preparado; Spotify embed; admin privado; export CSV; Next.js + TS + Tailwind.
