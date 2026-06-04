# Sync-Stock - Sistema de Gestión de Inventario Omnicanal

Sync-Stock es una plataforma segura de gestión de inventario omnicanal diseñada para la tienda especializada **"PescaTotal"**. Su objetivo principal es actuar como un núcleo de datos centralizado que sincroniza el inventario en tiempo real entre la tienda física y los canales de comercio electrónico (e-commerce), eliminando por completo los problemas de sobreventa y fricción con los clientes.

---

## 🛠️ Stack Tecnológico

El sistema se ha diseñado utilizando tecnologías modernas y robustas para garantizar transacciones seguras y de baja latencia:

*   **Motor de Base de Datos:** PostgreSQL (con PgBouncer para connection pooling).
*   **Columna Vertebral de Integración:** Enterprise Service Bus (ESB) con RabbitMQ (AMQP).
*   **Arquitectura:** Arquitectura Orientada a Servicios (SOA) con desacoplamiento mediante mensajería asíncrona.
*   **Formatos de Intercambio:** JSON / Modelo de Datos Canónico.
*   **Seguridad:** Autenticación y Autorización basada en Roles (RBAC) mediante JWT (JSON Web Tokens) firmados con algoritmos criptográficos sobre canales seguros HTTPS/TLS.

---

## 🏗️ Arquitectura y Patrones de Mediación SOA

El sistema utiliza un **Enterprise Service Bus (ESB)** que actúa como mediador inteligente, aplicando patrones clásicos de integración empresarial (EIP):

1.  **Enrutamiento Basado en Contenido (Content-Based Router):** Inspecciona el origen de las órdenes (físicas o web) y las deriva automáticamente al canal correspondiente (facturación inmediata o cola de validación/reserva).
2.  **Transformación de Datos (Data Transformer):** Traduce formatos XML o JSON propietarios de canales externos al esquema canónico del sistema.
3.  **Enriquecimiento de Mensajes (Message Enricher):** Completa payloads básicos con información de inventario y catálogos en tránsito.
4.  **Puente de Protocolos (Protocol Bridge):** Conecta las peticiones HTTP REST síncronas del frontend con colas de mensajería asíncronas AMQP en el backend.

---

## 🗄️ Modelo de Datos y Mecanismos de Persistencia

Para asegurar la integridad transaccional y evitar condiciones de carrera en ventas simultáneas, se implementaron las siguientes decisiones de diseño en **PostgreSQL**:

*   **Consistencia Transaccional (ACID):** Nivel de aislamiento *Read Committed* con bloqueos pesimistas explícitos.
*   **Bloqueo Pesimista (Pessimistic Locking):** Uso de la sentencia `SELECT ... FOR UPDATE` sobre el stock de productos durante las reservas.
*   **Prevención de Deadlocks:** Ordenamiento determinista de los artículos en todas las consultas transaccionales de actualización.
*   **Política de Expiración de Reservas:** Las reservas del canal web tienen un tiempo de vida (TTL) de **15 minutos**. Un daemon en background las revierte automáticamente si el pago no es confirmado en dicho lapso.

---

## 📝 Instrucciones de Git para Subir el Proyecto

Ejecutar los siguientes comandos para subir el proyecto:

```bash
# 1. Agrega todos los archivos nuevos (informe, pdf, .gitignore, README.md)
git add .

# 2. Confirma el commit localmente
git commit -m "text"

git push
```
