# Estructura de Base de Datos - ERP Rentas Industriales

## Resumen

Evolución del modelo actual sin eliminar datos existentes. Se añaden columnas con `DEFAULT` y tablas nuevas.

---

## 1. Unidades (modificaciones)

### Columnas nuevas en `unidades`

| Columna             | Tipo   | Default          | Descripción                                      |
|---------------------|--------|------------------|--------------------------------------------------|
| `tipo_unidad`       | TEXT   | 'remolque_seco'  | remolque_seco \| refrigerado \| maquinaria       |
| `estado_mantenimiento` | TEXT | 'disponible'     | disponible \| en_mantenimiento \| fuera_de_servicio |
| `horas_motor`       | INTEGER| 0                | Solo refrigerados/maquinaria                     |

---

## 2. Rentas (modificaciones + nuevas columnas)

### Columnas nuevas en `rentas`

| Columna               | Tipo  | Default     | Descripción                                           |
|-----------------------|-------|-------------|-------------------------------------------------------|
| `tipo_servicio`       | TEXT  | 'solo_renta'| solo_renta \| con_operador \| con_transporte          |
| `ubicacion_entrega`   | TEXT  | ''          | Dirección/lugar de entrega                            |
| `ubicacion_recoleccion` | TEXT | ''          | Dirección/lugar de recolección                        |
| `estado_logistico`    | TEXT  | 'programado'| programado \| en_camino \| entregado \| finalizado    |
| `precio_base`         | REAL  | 0           | Precio base de la renta                               |
| `extras`              | REAL  | 0           | Extras (operador, combustible, seguros)               |
| `operador_asignado`   | TEXT  | ''          | Nombre del operador (maquinaria / con_operador)       |

**Nota:** `monto` = `precio_base` + `extras` (total). Se mantiene por compatibilidad.

---

## 3. Tablas nuevas

### 3.1 `rentas_refrigerado` (1:1 cuando unidad es refrigerado)

| Columna               | Tipo   | Descripción                    |
|-----------------------|--------|--------------------------------|
| id                    | INTEGER| PK                             |
| renta_id              | INTEGER| FK → rentas                    |
| temperatura_objetivo  | REAL   | °C                             |
| combustible_inicio    | INTEGER| % (0-100)                      |
| combustible_fin       | INTEGER| % (0-100)                      |
| horas_motor_inicio    | INTEGER|                                |
| horas_motor_fin       | INTEGER|                                |
| observaciones         | TEXT   |                                |

### 3.2 `rentas_maquinaria` (1:1 cuando unidad es maquinaria)

| Columna           | Tipo   | Descripción           |
|-------------------|--------|-----------------------|
| id                | INTEGER| PK                    |
| renta_id          | INTEGER| FK → rentas           |
| operador_asignado | TEXT   |                       |
| horas_trabajadas  | REAL   |                       |
| tipo_trabajo      | TEXT   | Construcción, demolición, etc. |
| observaciones     | TEXT   |                       |

### 3.3 `pagos` (historial de pagos por renta)

| Columna     | Tipo   | Descripción                                           |
|-------------|--------|-------------------------------------------------------|
| id          | INTEGER| PK                                                    |
| renta_id    | INTEGER| FK → rentas                                           |
| monto       | REAL   |                                                       |
| tipo        | TEXT   | anticipo \| pago_parcial \| pago_final \| deposito \| extra \| devolucion_deposito |
| metodo      | TEXT   | efectivo \| transferencia \| tarjeta \| cheque        |
| fecha       | TEXT   | YYYY-MM-DD                                            |
| referencia  | TEXT   | Número de transacción, folio, etc.                    |
| observaciones | TEXT |                                                       |
| creado_en   | TEXT   |                                                       |

### 3.4 `rentas_documentos`

| Columna   | Tipo   | Descripción                               |
|-----------|--------|-------------------------------------------|
| id        | INTEGER| PK                                        |
| renta_id  | INTEGER| FK → rentas                               |
| tipo      | TEXT   | contrato \| factura \| check_list \| otro |
| nombre    | TEXT   |                                           |
| ruta      | TEXT   | Ruta del archivo en uploads               |
| creado_en | TEXT   |                                           |

### 3.5 `rentas_historial` (log de eventos por renta)

| Columna   | Tipo   | Descripción       |
|-----------|--------|-------------------|
| id        | INTEGER| PK                |
| renta_id  | INTEGER| FK → rentas       |
| accion    | TEXT   | Descripción corta |
| detalle   | TEXT   | Descripción larga |
| usuario_id| INTEGER| FK → usuarios (opcional) |
| fecha     | TEXT   |                   |

### 3.6 `mantenimiento` (por unidad)

| Columna    | Tipo   | Descripción                                      |
|------------|--------|--------------------------------------------------|
| id         | INTEGER| PK                                               |
| unidad_id  | INTEGER| FK → unidades                                    |
| tipo       | TEXT   | preventivo \| correctivo \| revision             |
| descripcion| TEXT   |                                                  |
| costo      | REAL   | 0                                                |
| fecha_inicio| TEXT  |                                                  |
| fecha_fin  | TEXT   | NULL si en curso                                 |
| estado     | TEXT   | programado \| en_proceso \| completado \| pospuesto |
| creado_en  | TEXT   |                                                  |

---

## 4. Índices

```
idx_unidades_tipo
idx_unidades_estado_mantenimiento
idx_rentas_tipo_servicio
idx_rentas_estado_logistico
idx_pagos_renta
idx_rentas_documentos_renta
idx_rentas_historial_renta
idx_mantenimiento_unidad
idx_mantenimiento_estado
```

---

## 5. Compatibilidad

- Todas las columnas nuevas tienen `DEFAULT` para no romper datos existentes.
- Rentas actuales quedan como `tipo_servicio = 'solo_renta'`, `estado_logistico = 'programado'`.
- Unidades actuales: `tipo_unidad = 'remolque_seco'`, `estado_mantenimiento = 'disponible'`.
