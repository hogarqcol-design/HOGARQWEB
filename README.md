# Hogarq · tienda y pedidos

La página conserva su diseño y el pedido por Instagram. Las fichas permiten elegir color, añadir al carrito y comprar ahora. El carrito persiste únicamente productos y cantidades en el navegador; no guarda datos de entrega allí.

## Estado de esta versión

Implementación preparada para Vercel y probada localmente con servicios simulados. **Los cobros están desactivados por defecto.** Aún hay que conectar el almacenamiento de pedidos y el webhook, desplegar Preview y completar una compra de prueba real de extremo a extremo antes de habilitar producción. Las credenciales que ya se guardaron en el panel de Vercel no son accesibles desde este repositorio.

## Reglas del negocio

- Precios, colores, medidas y material: `assets/catalog.js`, compartido por navegador y servidor.
- Bogotá D.C.: 20.000 COP por pedido, cualquier cantidad.
- Fuera de Bogotá: 1 unidad = 30.000; 2 = 50.000; desde 3 = 20.000 por unidad. Se cuentan todas las unidades, también si tienen modelos o colores distintos.
- Bogotá: fabricación y entrega en 2–4 días hábiles; resto del país: 4–7, desde la aprobación del pago.
- Todos los colores disponibles bajo pedido. Más de 50 unidades se tramitan por Instagram.
- Dirección y barrio obligatorios; apartamento e indicaciones opcionales.
- El aviso del pedido y la confirmación del comprador no requieren respuesta ni aprobación manual.

## Desarrollo local

Node.js 22. No hay dependencias de ejecución.

```sh
node --test tests/*.test.js
node scripts/build.js
node scripts/dev.js
```

Abrir http://127.0.0.1:4173. Sin secretos, se puede revisar todo el carrito y se muestra la alternativa de Instagram; el botón de pago permanece desactivado. El servidor local no pretende sustituir una prueba de la integración pública con Mercado Pago.

`tests/browser.cjs` verifica la interfaz con Playwright instalado en el entorno de desarrollo. Requiere el servidor local activo. Usa Edge por defecto; `BROWSER_CHANNEL` permite elegir otro canal. Las capturas se guardan en `test-results/` (ignorado por Git).

## Preparar Preview en Vercel

La rama de trabajo es `codex/carrito-mercadopago`. No mezclar en `main` antes de aprobar las pruebas. `vercel.json` establece Node Functions en `api/` y un directorio público que solo incluye la página, scripts del navegador, imágenes e iconos. Los archivos del servidor, pruebas, documentación y variables privadas no se publican como archivos descargables.

En el proyecto de Vercel, crear estas variables **solo en Preview**:

| Variable | Valor / tipo |
| --- | --- |
| `MERCADOPAGO_ACCESS_TOKEN` | Secret. Access Token del vendedor de prueba, ya configurado por el propietario. |
| `RESEND_API_KEY` | Secret. Clave con permiso de envío para hogarq.store, ya configurada. |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secret. Firma secreta generada en Webhooks de la aplicación de Mercado Pago. No es el Access Token. |
| `UPSTASH_REDIS_REST_URL` | URL HTTPS del almacenamiento privado Upstash Redis. |
| `UPSTASH_REDIS_REST_TOKEN` | Secret. Token REST de escritura de esa base. |
| `PAYMENT_MODE` | Config: `test`. |
| `SITE_URL` | Config: URL HTTPS **estable de la rama Preview**, sin ruta. Se usa para retorno y notificaciones. Puede omitirse si `VERCEL_BRANCH_URL` está disponible y es accesible. |
| `CHECKOUT_ENABLED` | Config: `true` solamente cuando estén configurados los valores anteriores. |
| `EMAIL_FROM` | Config opcional: `Hogarq <pedidos@hogarq.store>`. |
| `ORDER_EMAIL` | Config opcional: `hogarqcol@gmail.com`. |
| `TEST_EMAIL` | Config opcional: `hogarqcol@gmail.com`. En pruebas, ambos avisos se envían SOLO a esta dirección. |

### Almacenamiento de pedidos

En Vercel Marketplace / Storage, conectar **Upstash Redis** al proyecto y al entorno Preview, o crear una base directamente en Upstash. Revisar el plan y los costos antes de contratar. Copiar los valores REST en los nombres exactos de la tabla si la integración usa otros nombres (por ejemplo `KV_REST_API_*`). No sirve únicamente una URL de conexión TCP `redis://`.

Esta base conserva el pedido antes de abrir Mercado Pago, sus datos de entrega, la referencia del pago y qué correos se enviaron. Los datos no se guardan en GitHub. Usar una base distinta para producción; el código además separa claves `hogarq:test:` y `hogarq:live:`. No activar expulsión automática de claves: perder pedidos elimina la evidencia de pago y la deduplicación. Los pedidos se conservan sin caducidad automática en esta primera versión; el propietario debe definir después su política de conservación, exportación y eliminación de datos.

### Notificaciones de Mercado Pago

1. Aplicación **Hogarq Web → Webhooks → Configurar notificaciones**, entorno de prueba.
2. URL: `https://URL-ESTABLE-DE-PREVIEW/api/mercadopago-webhook` (reemplazar por la URL real).
3. Elegir eventos de **Pagos** para Checkout Pro por Preferences API.
4. Guardar y copiar la firma secreta en `MERCADOPAGO_WEBHOOK_SECRET` en Vercel, tipo Secret, Preview.
5. Volver a desplegar Preview para aplicar las variables.

El endpoint debe ser accesible a los servidores de Mercado Pago. La vista previa actual requiere inicio de sesión. En Vercel → Settings → Deployment Protection → Protection Bypass for Automation, generar un secreto para esta integración. Vercel lo incluye como `VERCEL_AUTOMATION_BYPASS_SECRET` en los despliegues nuevos. El servidor lo añade únicamente a la URL de notificación que envía a Mercado Pago en Preview; no lo devuelve al navegador. Volver a desplegar después de crearlo. No hace falta desactivar la protección del proyecto. No compartir este token ni la URL que lo contiene por chat. Si se usa el simulador del panel de Mercado Pago, su URL también necesita ese parámetro privado. Los pedidos creados desde la tienda ya lo llevan automáticamente.

El simulador de Mercado Pago puede usar un pago ficticio que no existe en la API. La prueba final debe ser una compra con cuentas/tarjetas de prueba y un pedido creado por la tienda; un resultado del simulador por sí solo no verifica el flujo.

## Verificación antes de publicar

1. Abrir Preview y confirmar aviso **Modo de prueba**.
2. Crear pedidos Bogotá y fuera de Bogotá con 1, 2, 3 y 5 unidades. Verificar importes antes de pagar.
3. Usar una cuenta compradora de prueba distinta del vendedor de prueba; no usar dinero real ni tarjeta personal.
4. Aprobar un pago de prueba y comprobar el registro en Mercado Pago, estado de la tienda y dos correos a Hogarq. Los mensajes dicen **PRUEBA · NO FABRICAR**.
5. Confirmar modelo, color, unidades, precios, envío, total, nombre, correo, teléfono, departamento, municipio, dirección, barrio, apartamento, indicaciones, referencia y plazo.
6. Repetir la notificación: no debe repetir correos. Probar pendiente/rechazado y comprobar que no se anuncie pago aprobado.
7. Cerrar la página antes de terminar el pago: el webhook debe confirmar igualmente el pedido y enviar los avisos. Esta prueba requiere que la URL no esté bloqueada por la protección de Preview.
8. Verificar la alternativa de Instagram y el botón Volver en móvil.

## Producción (no activada)

Después de las pruebas y aprobación del propietario: usar la cuenta vendedora real colombiana, claves y base separadas en Production, `PAYMENT_MODE=production`, `SITE_URL=https://hogarq.store`, configurar webhook productivo, y activar `CHECKOUT_ENABLED=true`. El código impide modo producción en un despliegue que no sea Production. Una cuenta de prueba no puede usarse para cobrar en producción.

## Seguridad y recuperación

- Totales, precios, variantes y envío se recalculan en el servidor; no se aceptan importes del navegador.
- Las notificaciones se validan con HMAC. Después se consulta la API de Mercado Pago y se verifica importe, moneda, vendedor, modo prueba/real, pedido y preferencia. La URL de retorno no puede aprobar pagos.
- Los estados pendiente, rechazado, reembolsado y contracargo no anuncian una compra aprobada.
- El acceso al estado requiere una referencia aleatoria más un token privado de la pestaña. La respuesta no revela la dirección ni el teléfono.
- Un bloqueo Redis protege la actualización concurrente. Se guardan por separado los envíos de correo. Resend recibe claves de idempotencia para los reintentos.
- Si Resend falla, el webhook devuelve error para que Mercado Pago reintente. La consulta del estado también intenta reconciliar. No depender de tener la pestaña abierta.
- Si un envío queda ambiguo más de 23 horas (cerca del límite de idempotencia de Resend), se marca `receipts.*.needsReview` y se registra `hogarq_email_delivery_review`. Revisar el historial de Resend y el pedido en Redis antes de reenviar manualmente. Así no se repite un correo que pudo haberse enviado. Un pago adicional aprobado se marca para revisión con `hogarq_duplicate_payment_review`.
- Sin datos completos de configuración el checkout falla cerrado y ofrece Instagram. No hay endpoint público para mandar correos arbitrarios.
- `.env*`, archivos de Vercel y resultados de pruebas están excluidos de Git. Nunca colocar secretos dentro del HTML o `assets/`.

## Referencias de integración

- [Mercado Pago Checkout Pro Preferences](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-preferences/create-payment-preference)
- [Firma y reintentos de webhooks](https://www.mercadopago.com.co/developers/es/docs/checkout-pro-preferences/additional-content/notifications/webhooks)
- [API de correos e idempotencia de Resend](https://resend.com/docs/api-reference/emails/send-email)
- [Upstash REST API](https://upstash.com/docs/redis/features/restapi)
- [Variables de Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables)
- [Acceso de webhooks a vistas previas protegidas](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
