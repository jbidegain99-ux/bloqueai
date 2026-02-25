"""
Generador de contratos laborales para El Salvador.

Templates estándar — REVISAR CON ABOGADO antes de usar en producción.
"""

import io
from datetime import date
from decimal import Decimal
from typing import Optional

# ── Templates ─────────────────────────────────────────────────

CONTRATO_INDEFINIDO_TEMPLATE = """
CONTRATO INDIVIDUAL DE TRABAJO POR TIEMPO INDEFINIDO

En la ciudad de San Salvador, a los {dia} días del mes de {mes} de {año}.

NOSOTROS: {empresa_nombre}, con Número de Identificación Tributaria {empresa_nit},
que en adelante se denominará "EL PATRONO", representada legalmente por su
representante legal debidamente acreditado;

Y {empleado_nombre_completo}, de nacionalidad salvadoreña,
del domicilio de {empleado_domicilio},
con Documento Único de Identidad número {empleado_dui} y
Número de Identificación Tributaria {empleado_nit},
que en adelante se denominará "EL TRABAJADOR".

CONVENIMOS en celebrar el presente CONTRATO INDIVIDUAL DE TRABAJO,
contenido en las cláusulas siguientes:

PRIMERA: CLASE DE TRABAJO
El trabajador se obliga a prestar sus servicios al patrono como {puesto},
desempeñando las funciones propias del cargo y las que el patrono le indique,
siempre que sean compatibles con su aptitud, condición y capacidad.

SEGUNDA: DURACIÓN DEL CONTRATO
El presente contrato se celebra por TIEMPO INDEFINIDO, a partir del día
{fecha_inicio}.

TERCERA: LUGAR DE TRABAJO
El trabajador prestará sus servicios en {lugar_trabajo}.

CUARTA: HORARIO DE TRABAJO
El horario de trabajo será de {horario_inicio} a {horario_fin},
de lunes a viernes, con {minutos_almuerzo} minutos para tomar alimentos.
La jornada ordinaria diurna no excederá de ocho horas diarias
ni de cuarenta y cuatro horas semanales.

QUINTA: SALARIO
El patrono pagará al trabajador un salario de ${salario_mensual}
({salario_letras}) DOLARES DE LOS ESTADOS UNIDOS DE AMERICA mensuales,
pagaderos en forma {frecuencia_pago}.

SEXTA: FORMA DE PAGO
El salario se pagará mediante {forma_pago}.

SÉPTIMA: HERRAMIENTAS Y MATERIALES
El patrono proporcionará al trabajador las herramientas y materiales
necesarios para el desempeño de sus labores.

OCTAVA: OBLIGACIONES DEL TRABAJADOR
El trabajador se compromete a cumplir con las disposiciones del
Reglamento Interno de Trabajo, así como las instrucciones que le dé
el patrono o sus representantes.

NOVENA: PRESTACIONES LEGALES
El trabajador tendrá derecho a las prestaciones establecidas por la ley:
a) Aguinaldo, de conformidad con el Art. 196 del Código de Trabajo
b) Vacación anual remunerada, Art. 177 del Código de Trabajo
c) Indemnización por despido injustificado, Art. 58 del Código de Trabajo
d) Las demás prestaciones que establezca la legislación laboral vigente

DÉCIMA: SEGURIDAD SOCIAL
El patrono inscribirá al trabajador en el Instituto Salvadoreño del
Seguro Social (ISSS) y en una Administradora de Fondos de Pensiones (AFP),
realizando las cotizaciones correspondientes conforme a la ley.

En fe de lo cual firmamos el presente contrato en dos ejemplares de un mismo tenor,
en el lugar y fecha arriba indicados.


_____________________________          _____________________________
{empresa_nombre}                       {empleado_nombre_completo}
EL PATRONO                             EL TRABAJADOR
"""

CONTRATO_PLAZO_FIJO_TEMPLATE = """
CONTRATO INDIVIDUAL DE TRABAJO A PLAZO FIJO

En la ciudad de San Salvador, a los {dia} días del mes de {mes} de {año}.

NOSOTROS: {empresa_nombre}, con Número de Identificación Tributaria {empresa_nit},
que en adelante se denominará "EL PATRONO", representada legalmente por su
representante legal debidamente acreditado;

Y {empleado_nombre_completo}, de nacionalidad salvadoreña,
del domicilio de {empleado_domicilio},
con Documento Único de Identidad número {empleado_dui} y
Número de Identificación Tributaria {empleado_nit},
que en adelante se denominará "EL TRABAJADOR".

CONVENIMOS en celebrar el presente CONTRATO INDIVIDUAL DE TRABAJO A PLAZO FIJO,
contenido en las cláusulas siguientes:

PRIMERA: CLASE DE TRABAJO
El trabajador se obliga a prestar sus servicios al patrono como {puesto},
desempeñando las funciones propias del cargo.

SEGUNDA: DURACIÓN DEL CONTRATO
El presente contrato se celebra por un PLAZO DETERMINADO, iniciando el día
{fecha_inicio} y terminando el día {fecha_fin}, por la naturaleza temporal
del trabajo a realizar.

TERCERA: LUGAR DE TRABAJO
El trabajador prestará sus servicios en {lugar_trabajo}.

CUARTA: HORARIO DE TRABAJO
El horario de trabajo será de {horario_inicio} a {horario_fin},
de lunes a viernes, con {minutos_almuerzo} minutos para tomar alimentos.

QUINTA: SALARIO
El patrono pagará al trabajador un salario de ${salario_mensual}
({salario_letras}) DOLARES DE LOS ESTADOS UNIDOS DE AMERICA mensuales,
pagaderos en forma {frecuencia_pago}.

SEXTA: FORMA DE PAGO
El salario se pagará mediante {forma_pago}.

SÉPTIMA: HERRAMIENTAS Y MATERIALES
El patrono proporcionará al trabajador las herramientas y materiales necesarios.

OCTAVA: PRESTACIONES LEGALES
El trabajador tendrá derecho a las prestaciones establecidas por la ley,
proporcionales al tiempo de servicio prestado.

NOVENA: SEGURIDAD SOCIAL
El patrono inscribirá al trabajador en el ISSS y AFP correspondiente.

DÉCIMA: TERMINACIÓN
El contrato terminará automáticamente al vencimiento del plazo estipulado
en la cláusula segunda, sin responsabilidad para ninguna de las partes.

En fe de lo cual firmamos en dos ejemplares de un mismo tenor.


_____________________________          _____________________________
{empresa_nombre}                       {empleado_nombre_completo}
EL PATRONO                             EL TRABAJADOR
"""

# ── Number-to-words (Spanish) ─────────────────────────────────

_UNIDADES = [
    "", "uno", "dos", "tres", "cuatro", "cinco",
    "seis", "siete", "ocho", "nueve", "diez",
    "once", "doce", "trece", "catorce", "quince",
    "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte",
]
_DECENAS = [
    "", "", "veinti", "treinta", "cuarenta", "cincuenta",
    "sesenta", "setenta", "ochenta", "noventa",
]
_CENTENAS = [
    "", "ciento", "doscientos", "trescientos", "cuatrocientos",
    "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos",
]

MESES = [
    "", "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]


def _number_to_words(n: int) -> str:
    """Convert integer to Spanish words (simplified, up to 999,999)."""
    if n == 0:
        return "cero"
    if n == 100:
        return "cien"

    parts: list[str] = []

    if n >= 1000:
        miles = n // 1000
        n %= 1000
        if miles == 1:
            parts.append("mil")
        else:
            parts.append(_number_to_words(miles) + " mil")

    if n >= 100:
        parts.append(_CENTENAS[n // 100])
        n %= 100

    if n <= 20:
        if n > 0:
            parts.append(_UNIDADES[n])
    elif n < 30:
        parts.append("veinti" + _UNIDADES[n - 20])
    else:
        d = n // 10
        u = n % 10
        if u == 0:
            parts.append(_DECENAS[d])
        else:
            parts.append(f"{_DECENAS[d]} y {_UNIDADES[u]}")

    return " ".join(p for p in parts if p)


def _salary_to_words(amount: Decimal) -> str:
    """Convert salary amount to Spanish words."""
    integer_part = int(amount)
    decimal_part = int(round((amount - integer_part) * 100))
    words = _number_to_words(integer_part)
    if decimal_part > 0:
        return f"{words} con {decimal_part}/100"
    return f"{words} 00/100"


# ── Generator ─────────────────────────────────────────────────


class ContractGenerator:
    """Generates employment contracts for El Salvador."""

    EMPLOYER_NAME = "Bloque S.A. de C.V."
    EMPLOYER_NIT = "0000-000000-000-0"  # Placeholder

    def generate_indefinite_contract(
        self,
        employee: dict,
        position: str,
        salary: Decimal,
        start_date: date,
        work_location: str = "San Salvador, El Salvador",
        schedule_start: str = "08:00",
        schedule_end: str = "17:00",
        lunch_minutes: int = 60,
        payment_frequency: str = "mensual",
        payment_method: str = "depósito bancario",
    ) -> str:
        """Generate an indefinite-term employment contract."""
        return CONTRATO_INDEFINIDO_TEMPLATE.format(
            dia=start_date.day,
            mes=MESES[start_date.month],
            año=start_date.year,
            empresa_nombre=self.EMPLOYER_NAME,
            empresa_nit=self.EMPLOYER_NIT,
            empleado_nombre_completo=f"{employee.get('first_name', '')} {employee.get('last_name', '')}",
            empleado_domicilio=employee.get("address", "San Salvador"),
            empleado_dui=employee.get("dui", "________-_"),
            empleado_nit=employee.get("nit", "____-______-___-_"),
            puesto=position,
            fecha_inicio=start_date.strftime("%d de %B de %Y").replace(
                start_date.strftime("%B"), MESES[start_date.month]
            ),
            lugar_trabajo=work_location,
            horario_inicio=schedule_start,
            horario_fin=schedule_end,
            minutos_almuerzo=lunch_minutes,
            salario_mensual=f"{salary:,.2f}",
            salario_letras=_salary_to_words(salary).upper(),
            frecuencia_pago=payment_frequency,
            forma_pago=payment_method,
        )

    def generate_fixed_term_contract(
        self,
        employee: dict,
        position: str,
        salary: Decimal,
        start_date: date,
        end_date: date,
        work_location: str = "San Salvador, El Salvador",
        schedule_start: str = "08:00",
        schedule_end: str = "17:00",
        lunch_minutes: int = 60,
        payment_frequency: str = "mensual",
        payment_method: str = "depósito bancario",
    ) -> str:
        """Generate a fixed-term employment contract."""
        return CONTRATO_PLAZO_FIJO_TEMPLATE.format(
            dia=start_date.day,
            mes=MESES[start_date.month],
            año=start_date.year,
            empresa_nombre=self.EMPLOYER_NAME,
            empresa_nit=self.EMPLOYER_NIT,
            empleado_nombre_completo=f"{employee.get('first_name', '')} {employee.get('last_name', '')}",
            empleado_domicilio=employee.get("address", "San Salvador"),
            empleado_dui=employee.get("dui", "________-_"),
            empleado_nit=employee.get("nit", "____-______-___-_"),
            puesto=position,
            fecha_inicio=start_date.strftime("%d de %B de %Y").replace(
                start_date.strftime("%B"), MESES[start_date.month]
            ),
            fecha_fin=end_date.strftime("%d de %B de %Y").replace(
                end_date.strftime("%B"), MESES[end_date.month]
            ),
            lugar_trabajo=work_location,
            horario_inicio=schedule_start,
            horario_fin=schedule_end,
            minutos_almuerzo=lunch_minutes,
            salario_mensual=f"{salary:,.2f}",
            salario_letras=_salary_to_words(salary).upper(),
            frecuencia_pago=payment_frequency,
            forma_pago=payment_method,
        )

    def generate_pdf(self, contract_text: str) -> bytes:
        """Convert contract text to a valid multi-page PDF using reportlab."""
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=72,
            leftMargin=72,
            topMargin=72,
            bottomMargin=72,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "ContractTitle",
            parent=styles["Heading1"],
            fontSize=13,
            spaceAfter=18,
            alignment=1,  # center
        )
        body_style = ParagraphStyle(
            "ContractBody",
            parent=styles["Normal"],
            fontSize=10,
            leading=14,
            spaceAfter=6,
        )

        story: list = []
        paragraphs = contract_text.strip().split("\n\n")

        for i, para in enumerate(paragraphs):
            text = para.strip()
            if not text:
                continue
            # Replace newlines within a paragraph with <br/>
            text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            text = text.replace("\n", "<br/>")
            # First paragraph is the title
            style = title_style if i == 0 else body_style
            story.append(Paragraph(text, style))
            story.append(Spacer(1, 6))

        # Signature block
        story.append(Spacer(1, 0.5 * inch))

        doc.build(story)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        return pdf_bytes
