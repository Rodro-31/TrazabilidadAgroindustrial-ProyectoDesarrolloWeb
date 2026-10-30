# Modelo de Datos y Entidad-Relación

El modelo de base de datos relacional (PostgreSQL) está diseñado para garantizar la integridad de la trazabilidad del cardamomo, el control estricto de inventarios y la auditoría de cada operación.

```mermaid
erDiagram
    Usuario ||--o{ UsuarioCentro : "pertenece"
    Usuario ||--o{ Lote : "crea"
    Usuario ||--o{ MovimientoInventario : "registra"
    Usuario ||--o{ Recepcion : "registra"
    Usuario ||--o{ Traslado : "solicita/recibe"
    Usuario ||--o{ Tarea : "se le asigna"

    Centro ||--o{ UsuarioCentro : "tiene"
    Centro ||--o{ Existencia : "almacena"
    Centro ||--o{ Recepcion : "recibe"
    Centro ||--o{ Traslado : "origen/destino"
    Centro ||--o{ Lote : "crea"

    Organizacion ||--o{ Productor : "agrupa"
    Productor ||--o{ Finca : "posee"
    Productor ||--o{ Recepcion : "entrega"
    Productor ||--o{ Liquidacion : "recibe pago"

    Finca ||--o{ Recepcion : "origen de"

    Comprador ||--o{ Venta : "compra"

    Recepcion ||--o{ LoteOrigenRecepcion : "compone"
    Recepcion ||--o{ InspeccionCalidad : "evaluada por"
    Recepcion ||--o| LiquidacionDetalle : "se paga en"

    Lote ||--o{ LoteOrigenRecepcion : "se forma de"
    Lote ||--o{ LoteRelacion : "padre/hijo"
    Lote ||--o{ Existencia : "disponible en"
    Lote ||--o{ LoteEstadoHistorial : "cambia estado"
    Lote ||--o{ MovimientoInventario : "tiene movimientos"
    Lote ||--o{ InspeccionCalidad : "evaluado por"
    Lote ||--o{ Traslado : "se mueve en"
    Lote ||--o{ Venta : "se vende en"

    Proceso ||--o{ LoteRelacion : "genera"

    Liquidacion ||--o{ LiquidacionDetalle : "contiene"
    GradoCalidad ||--o{ Lote : "clasifica"
    GradoCalidad ||--o{ InspeccionCalidad : "determina"
```
## Justificación de Relaciones Clave
* Trazabilidad Continua: La tabla Lote se relaciona de manera recursiva mediante LoteRelacion para formar el grafo de mezclas, divisiones y transformaciones (uva, pergamino, oro).  
* Origen Garantizado: Ningún lote existe en el vacío; obligatoriamente proviene de una Recepcion (vía LoteOrigenRecepcion) o de un lote previo.  
* Inventario Inmutable: MovimientoInventario actúa como un libro mayor donde solo se insertan registros, asegurando un rastro auditable, mientras que Existencia refleja el saldo actual.  
* Seguridad: Las tablas Token y Auditoria respaldan los flujos operativos, garantizando que confirmaciones como los traslados y el escaneo de QR dejen huella en el sistema. 
