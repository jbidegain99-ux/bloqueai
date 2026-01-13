"""Massive job seed script - Creates 300+ diverse jobs for testing."""

import sys
import random
from pathlib import Path
from uuid import uuid4
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.company import Company
from app.models.job import Job, JobStatus, JobModality, SeniorityLevel, JobCategory
from app.models.rubric import Rubric


# =============================================================================
# COMPANY DATA - Diverse companies across industries
# =============================================================================
COMPANIES = [
    {
        "name": "TechNova Solutions",
        "slug": "technova-solutions",
        "industry": "Tecnologia",
        "description": "Empresa lider en desarrollo de software y soluciones cloud.",
        "size": "201-500",
    },
    {
        "name": "MediCare Plus",
        "slug": "medicare-plus",
        "industry": "Salud",
        "description": "Red de clinicas y hospitales con presencia nacional.",
        "size": "501-1000",
    },
    {
        "name": "Legal Partners International",
        "slug": "legal-partners",
        "industry": "Legal",
        "description": "Firma de abogados especializada en derecho corporativo.",
        "size": "51-200",
    },
    {
        "name": "IndustriaMex",
        "slug": "industriamex",
        "industry": "Manufactura",
        "description": "Fabricante de componentes automotrices y aeroespaciales.",
        "size": "1001-5000",
    },
    {
        "name": "Banco Financiero Central",
        "slug": "banco-financiero",
        "industry": "Finanzas",
        "description": "Institucion financiera con servicios bancarios y de inversion.",
        "size": "1001-5000",
    },
    {
        "name": "Sonrisas Dental Group",
        "slug": "sonrisas-dental",
        "industry": "Dental",
        "description": "Red de clinicas dentales con tecnologia de punta.",
        "size": "51-200",
    },
    {
        "name": "LogiTrans Express",
        "slug": "logitrans-express",
        "industry": "Logistica",
        "description": "Empresa de transporte y logistica nacional e internacional.",
        "size": "201-500",
    },
    {
        "name": "EduTech Academy",
        "slug": "edutech-academy",
        "industry": "Educacion",
        "description": "Plataforma educativa con programas de capacitacion empresarial.",
        "size": "51-200",
    },
    {
        "name": "Constructora Horizonte",
        "slug": "constructora-horizonte",
        "industry": "Construccion",
        "description": "Constructora de proyectos residenciales y comerciales.",
        "size": "201-500",
    },
    {
        "name": "BioResearch Labs",
        "slug": "bioresearch-labs",
        "industry": "Investigacion",
        "description": "Laboratorio de investigacion biotecnologica y farmaceutica.",
        "size": "51-200",
    },
    {
        "name": "RetailMax",
        "slug": "retailmax",
        "industry": "Retail",
        "description": "Cadena de tiendas departamentales y supermercados.",
        "size": "1001-5000",
    },
    {
        "name": "Hotel Paraiso Resort",
        "slug": "hotel-paraiso",
        "industry": "Hoteleria",
        "description": "Cadena hotelera con resorts de lujo en destinos turisticos.",
        "size": "501-1000",
    },
]


# =============================================================================
# JOB TEMPLATES BY CATEGORY
# =============================================================================
JOB_TEMPLATES = {
    JobCategory.TECHNOLOGY: [
        {
            "title": "Desarrollador Full Stack",
            "base_salary": (45000, 90000),
            "must_haves": ["JavaScript", "React", "Node.js", "SQL"],
            "nice_to_haves": ["TypeScript", "AWS", "Docker"],
            "responsibilities": ["Desarrollo de aplicaciones web", "Code review", "Documentacion tecnica"],
        },
        {
            "title": "Desarrollador Backend Python",
            "base_salary": (50000, 95000),
            "must_haves": ["Python", "FastAPI", "PostgreSQL", "REST APIs"],
            "nice_to_haves": ["Django", "Redis", "Kubernetes"],
            "responsibilities": ["Diseno de APIs", "Optimizacion de bases de datos", "Integraciones"],
        },
        {
            "title": "Desarrollador Frontend React",
            "base_salary": (40000, 80000),
            "must_haves": ["React", "JavaScript", "HTML/CSS", "Git"],
            "nice_to_haves": ["Next.js", "TypeScript", "Tailwind"],
            "responsibilities": ["Desarrollo de interfaces", "Optimizacion de rendimiento", "Testing"],
        },
        {
            "title": "Ingeniero DevOps",
            "base_salary": (60000, 110000),
            "must_haves": ["Docker", "Kubernetes", "CI/CD", "Linux"],
            "nice_to_haves": ["Terraform", "AWS", "Ansible"],
            "responsibilities": ["Automatizacion de infraestructura", "Monitoreo", "Seguridad"],
        },
        {
            "title": "Data Engineer",
            "base_salary": (55000, 100000),
            "must_haves": ["Python", "SQL", "ETL", "Data Pipelines"],
            "nice_to_haves": ["Spark", "Airflow", "Snowflake"],
            "responsibilities": ["Diseno de pipelines de datos", "Optimizacion de queries", "Data modeling"],
        },
        {
            "title": "QA Automation Engineer",
            "base_salary": (40000, 75000),
            "must_haves": ["Selenium", "Python/Java", "Test Automation", "API Testing"],
            "nice_to_haves": ["Cypress", "Jest", "Performance Testing"],
            "responsibilities": ["Desarrollo de tests automatizados", "Analisis de bugs", "QA strategy"],
        },
        {
            "title": "Mobile Developer iOS",
            "base_salary": (55000, 100000),
            "must_haves": ["Swift", "iOS SDK", "Xcode", "UIKit"],
            "nice_to_haves": ["SwiftUI", "Core Data", "ARKit"],
            "responsibilities": ["Desarrollo de apps iOS", "Publicacion en App Store", "Optimizacion"],
        },
        {
            "title": "Mobile Developer Android",
            "base_salary": (50000, 95000),
            "must_haves": ["Kotlin", "Android SDK", "Jetpack", "MVVM"],
            "nice_to_haves": ["Compose", "Firebase", "Room"],
            "responsibilities": ["Desarrollo de apps Android", "Play Store deployment", "Testing"],
        },
        {
            "title": "Arquitecto de Software",
            "base_salary": (90000, 150000),
            "must_haves": ["Arquitectura de sistemas", "Microservicios", "Cloud", "Design patterns"],
            "nice_to_haves": ["AWS Solutions Architect", "Event-driven", "DDD"],
            "responsibilities": ["Diseno de arquitectura", "Mentoría tecnica", "Decision making"],
        },
        {
            "title": "Data Scientist",
            "base_salary": (60000, 110000),
            "must_haves": ["Python", "Machine Learning", "SQL", "Estadistica"],
            "nice_to_haves": ["TensorFlow", "PyTorch", "NLP"],
            "responsibilities": ["Desarrollo de modelos ML", "Analisis de datos", "Presentacion de insights"],
        },
        {
            "title": "Machine Learning Engineer",
            "base_salary": (70000, 130000),
            "must_haves": ["Python", "Deep Learning", "MLOps", "TensorFlow/PyTorch"],
            "nice_to_haves": ["Kubeflow", "MLflow", "Computer Vision"],
            "responsibilities": ["Deploy de modelos ML", "Optimizacion de inferencia", "Pipeline ML"],
        },
        {
            "title": "Cloud Solutions Architect",
            "base_salary": (85000, 140000),
            "must_haves": ["AWS/Azure/GCP", "Arquitectura cloud", "Networking", "Seguridad"],
            "nice_to_haves": ["Multi-cloud", "Cost optimization", "Migration"],
            "responsibilities": ["Diseno de soluciones cloud", "Optimizacion de costos", "Migraciones"],
        },
        {
            "title": "Cybersecurity Analyst",
            "base_salary": (55000, 95000),
            "must_haves": ["Seguridad informatica", "Networking", "SIEM", "Incident response"],
            "nice_to_haves": ["Ethical hacking", "CISSP", "Forensics"],
            "responsibilities": ["Monitoreo de seguridad", "Respuesta a incidentes", "Auditorias"],
        },
        {
            "title": "Technical Lead",
            "base_salary": (80000, 130000),
            "must_haves": ["Liderazgo tecnico", "Full Stack", "Agile", "Code review"],
            "nice_to_haves": ["Management", "Architecture", "Mentoring"],
            "responsibilities": ["Liderazgo de equipo", "Decision tecnica", "Mentoria"],
        },
        {
            "title": "Product Manager Tech",
            "base_salary": (70000, 120000),
            "must_haves": ["Product management", "Agile/Scrum", "Analytics", "Stakeholder management"],
            "nice_to_haves": ["Technical background", "UX", "Data analysis"],
            "responsibilities": ["Roadmap de producto", "Priorización", "Coordinacion con equipos"],
        },
    ],
    JobCategory.HEALTHCARE: [
        {
            "title": "Médico General",
            "base_salary": (50000, 90000),
            "must_haves": ["Titulo de medicina", "Cédula profesional", "Experiencia clinica"],
            "nice_to_haves": ["Especialidad", "Urgencias", "Telemedicina"],
            "responsibilities": ["Consulta medica", "Diagnostico", "Seguimiento de pacientes"],
        },
        {
            "title": "Enfermero/a Registrado/a",
            "base_salary": (30000, 55000),
            "must_haves": ["Licenciatura en enfermeria", "Cedula profesional", "BLS/ACLS"],
            "nice_to_haves": ["Especialidad", "UCI", "Quirofano"],
            "responsibilities": ["Cuidado de pacientes", "Administracion de medicamentos", "Documentacion"],
        },
        {
            "title": "Especialista en Cardiología",
            "base_salary": (100000, 180000),
            "must_haves": ["Especialidad en cardiologia", "Board certified", "Experiencia clinica"],
            "nice_to_haves": ["Intervencionismo", "Electrofisiologia", "Research"],
            "responsibilities": ["Diagnostico cardiovascular", "Procedimientos", "Consulta especializada"],
        },
        {
            "title": "Técnico en Radiología",
            "base_salary": (25000, 45000),
            "must_haves": ["Titulo tecnico", "Certificacion", "Rayos X"],
            "nice_to_haves": ["Tomografia", "Resonancia", "Mamografia"],
            "responsibilities": ["Toma de estudios", "Calibracion de equipos", "Protocolos de seguridad"],
        },
        {
            "title": "Fisioterapeuta",
            "base_salary": (35000, 60000),
            "must_haves": ["Licenciatura en fisioterapia", "Cedula profesional", "Rehabilitacion"],
            "nice_to_haves": ["Deportiva", "Neurologica", "Pediatrica"],
            "responsibilities": ["Evaluacion funcional", "Plan de tratamiento", "Ejercicios terapeuticos"],
        },
        {
            "title": "Nutriólogo/a",
            "base_salary": (30000, 55000),
            "must_haves": ["Licenciatura en nutricion", "Cedula profesional", "Evaluacion nutricional"],
            "nice_to_haves": ["Clinica", "Deportiva", "Pediatrica"],
            "responsibilities": ["Planes alimenticios", "Seguimiento nutricional", "Educacion alimentaria"],
        },
        {
            "title": "Psicólogo/a Clínico/a",
            "base_salary": (35000, 65000),
            "must_haves": ["Licenciatura en psicologia", "Cedula profesional", "Terapia"],
            "nice_to_haves": ["Cognitivo-conductual", "Sistemica", "Neuropsicologia"],
            "responsibilities": ["Evaluacion psicologica", "Psicoterapia", "Intervencion en crisis"],
        },
        {
            "title": "Administrador de Hospital",
            "base_salary": (60000, 100000),
            "must_haves": ["Administracion hospitalaria", "Gestion de personal", "Presupuestos"],
            "nice_to_haves": ["MBA", "Normatividad sanitaria", "Calidad"],
            "responsibilities": ["Gestion operativa", "Recursos humanos", "Cumplimiento normativo"],
        },
        {
            "title": "Farmacéutico/a",
            "base_salary": (40000, 70000),
            "must_haves": ["Licenciatura en farmacia", "Cedula profesional", "Dispensacion"],
            "nice_to_haves": ["Hospitalario", "Clinico", "Regulatorio"],
            "responsibilities": ["Dispensacion de medicamentos", "Farmacovigilancia", "Asesoria"],
        },
        {
            "title": "Técnico en Laboratorio Clínico",
            "base_salary": (22000, 40000),
            "must_haves": ["Titulo tecnico", "Certificacion", "Analisis clinicos"],
            "nice_to_haves": ["Hematologia", "Quimica", "Microbiologia"],
            "responsibilities": ["Procesamiento de muestras", "Analisis", "Control de calidad"],
        },
    ],
    JobCategory.LEGAL: [
        {
            "title": "Abogado Corporativo",
            "base_salary": (50000, 100000),
            "must_haves": ["Titulo de abogado", "Cedula profesional", "Derecho corporativo"],
            "nice_to_haves": ["M&A", "Contratos", "Compliance"],
            "responsibilities": ["Asesoria legal", "Revision de contratos", "Due diligence"],
        },
        {
            "title": "Abogado Laboral",
            "base_salary": (45000, 85000),
            "must_haves": ["Titulo de abogado", "Derecho laboral", "Litigio"],
            "nice_to_haves": ["Seguridad social", "Colectivo", "Migratorio"],
            "responsibilities": ["Asesoria laboral", "Litigio", "Negociaciones"],
        },
        {
            "title": "Paralegal",
            "base_salary": (25000, 45000),
            "must_haves": ["Estudios en derecho", "Investigacion juridica", "Documentacion"],
            "nice_to_haves": ["Corporativo", "Litigio", "Propiedad intelectual"],
            "responsibilities": ["Apoyo legal", "Investigacion", "Gestion de expedientes"],
        },
        {
            "title": "Abogado de Propiedad Intelectual",
            "base_salary": (60000, 110000),
            "must_haves": ["Titulo de abogado", "Propiedad intelectual", "Marcas y patentes"],
            "nice_to_haves": ["Derecho tecnologico", "Licenciamiento", "Litigio IP"],
            "responsibilities": ["Registro de marcas", "Proteccion de patentes", "Litigio"],
        },
        {
            "title": "Compliance Officer",
            "base_salary": (55000, 95000),
            "must_haves": ["Derecho o afin", "Compliance", "Normatividad"],
            "nice_to_haves": ["Antilavado", "Proteccion de datos", "Certificaciones"],
            "responsibilities": ["Programas de cumplimiento", "Auditorias", "Capacitacion"],
        },
        {
            "title": "Notario Público",
            "base_salary": (80000, 150000),
            "must_haves": ["Titulo de notario", "Derecho civil", "Actos juridicos"],
            "nice_to_haves": ["Inmobiliario", "Sucesiones", "Mercantil"],
            "responsibilities": ["Fe publica", "Escrituras", "Tramites notariales"],
        },
        {
            "title": "Abogado Fiscal",
            "base_salary": (55000, 100000),
            "must_haves": ["Titulo de abogado", "Derecho fiscal", "Impuestos"],
            "nice_to_haves": ["Planeacion fiscal", "Comercio exterior", "Litigio fiscal"],
            "responsibilities": ["Asesoria fiscal", "Defensa fiscal", "Cumplimiento tributario"],
        },
    ],
    JobCategory.MANUFACTURING: [
        {
            "title": "Ingeniero de Producción",
            "base_salary": (40000, 75000),
            "must_haves": ["Ingenieria industrial", "Produccion", "Lean Manufacturing"],
            "nice_to_haves": ["Six Sigma", "SAP", "Kaizen"],
            "responsibilities": ["Optimizacion de procesos", "Control de produccion", "KPIs"],
        },
        {
            "title": "Supervisor de Planta",
            "base_salary": (35000, 60000),
            "must_haves": ["Ingenieria o afin", "Supervision de personal", "Manufactura"],
            "nice_to_haves": ["ISO", "5S", "TPM"],
            "responsibilities": ["Supervision de linea", "Control de calidad", "Seguridad"],
        },
        {
            "title": "Técnico de Mantenimiento",
            "base_salary": (25000, 45000),
            "must_haves": ["Tecnico mecanico/electrico", "Mantenimiento preventivo", "PLC"],
            "nice_to_haves": ["Neumatica", "Hidraulica", "Soldadura"],
            "responsibilities": ["Mantenimiento de equipos", "Reparaciones", "Preventivos"],
        },
        {
            "title": "Ingeniero de Calidad",
            "base_salary": (45000, 80000),
            "must_haves": ["Ingenieria", "Control de calidad", "ISO 9001"],
            "nice_to_haves": ["IATF 16949", "Core tools", "Auditor"],
            "responsibilities": ["Sistema de calidad", "Auditorias", "CAPA"],
        },
        {
            "title": "Gerente de Operaciones",
            "base_salary": (80000, 140000),
            "must_haves": ["Ingenieria", "Gestion de operaciones", "Liderazgo"],
            "nice_to_haves": ["MBA", "Black Belt", "Supply chain"],
            "responsibilities": ["Direccion de planta", "P&L", "Mejora continua"],
        },
        {
            "title": "Ingeniero de Procesos",
            "base_salary": (42000, 70000),
            "must_haves": ["Ingenieria", "Mejora de procesos", "Automatizacion"],
            "nice_to_haves": ["Robotica", "PLC", "Vision artificial"],
            "responsibilities": ["Diseño de procesos", "Implementacion", "Capacitacion"],
        },
        {
            "title": "Planeador de Producción",
            "base_salary": (35000, 55000),
            "must_haves": ["Ingenieria o afin", "MRP/ERP", "Planeacion"],
            "nice_to_haves": ["SAP", "Excel avanzado", "Supply chain"],
            "responsibilities": ["Plan de produccion", "Inventarios", "Coordinacion"],
        },
        {
            "title": "Operador de Maquinaria CNC",
            "base_salary": (20000, 38000),
            "must_haves": ["Tecnico mecanico", "CNC", "Lectura de planos"],
            "nice_to_haves": ["Programacion CNC", "Metrologia", "CAD/CAM"],
            "responsibilities": ["Operacion de CNC", "Setup", "Inspeccion"],
        },
        {
            "title": "Ingeniero de Seguridad Industrial",
            "base_salary": (45000, 75000),
            "must_haves": ["Ingenieria", "Seguridad industrial", "Normatividad"],
            "nice_to_haves": ["STPS", "ISO 45001", "Ergonomia"],
            "responsibilities": ["Programas de seguridad", "Investigacion de accidentes", "Capacitacion"],
        },
    ],
    JobCategory.FINANCE: [
        {
            "title": "Contador Público",
            "base_salary": (35000, 65000),
            "must_haves": ["Titulo de contador", "Cedula profesional", "Contabilidad"],
            "nice_to_haves": ["SAT", "NIIF", "SAP"],
            "responsibilities": ["Contabilidad general", "Reportes financieros", "Impuestos"],
        },
        {
            "title": "Analista Financiero",
            "base_salary": (40000, 75000),
            "must_haves": ["Finanzas/Contaduria", "Analisis financiero", "Excel avanzado"],
            "nice_to_haves": ["Modelaje financiero", "Power BI", "Python"],
            "responsibilities": ["Analisis de estados financieros", "Presupuestos", "Proyecciones"],
        },
        {
            "title": "Controller Financiero",
            "base_salary": (80000, 140000),
            "must_haves": ["Contaduria/Finanzas", "Control financiero", "USGAAP/IFRS"],
            "nice_to_haves": ["CPA", "Big 4", "ERP"],
            "responsibilities": ["Control interno", "Reportes a corporativo", "Cumplimiento"],
        },
        {
            "title": "Tesorero",
            "base_salary": (60000, 100000),
            "must_haves": ["Finanzas", "Tesoreria", "Cash management"],
            "nice_to_haves": ["FX", "Banking", "Treasury systems"],
            "responsibilities": ["Flujo de efectivo", "Relacion bancaria", "Inversiones"],
        },
        {
            "title": "Auditor Interno",
            "base_salary": (45000, 80000),
            "must_haves": ["Contaduria/Finanzas", "Auditoria interna", "Control interno"],
            "nice_to_haves": ["CIA", "CISA", "SOX"],
            "responsibilities": ["Auditorias", "Evaluacion de riesgos", "Recomendaciones"],
        },
        {
            "title": "Analista de Crédito",
            "base_salary": (35000, 60000),
            "must_haves": ["Finanzas/Economia", "Analisis crediticio", "Riesgo"],
            "nice_to_haves": ["Banca", "Scoring", "Cobranza"],
            "responsibilities": ["Evaluacion de credito", "Analisis de riesgo", "Recuperacion"],
        },
        {
            "title": "Director de Finanzas (CFO)",
            "base_salary": (150000, 300000),
            "must_haves": ["MBA/CPA", "Direccion financiera", "Estrategia"],
            "nice_to_haves": ["M&A", "IPO", "Investor relations"],
            "responsibilities": ["Estrategia financiera", "Relacion con inversionistas", "P&L"],
        },
        {
            "title": "Especialista en Nóminas",
            "base_salary": (30000, 50000),
            "must_haves": ["Contaduria/RH", "Nominas", "Legislacion laboral"],
            "nice_to_haves": ["SAP HCM", "Timbrado", "IMSS"],
            "responsibilities": ["Proceso de nomina", "Impuestos", "Prestaciones"],
        },
    ],
    JobCategory.DENTAL: [
        {
            "title": "Dentista General",
            "base_salary": (40000, 80000),
            "must_haves": ["Titulo de odontologo", "Cedula profesional", "Odontologia general"],
            "nice_to_haves": ["Endodoncia", "Estetica", "Implantes"],
            "responsibilities": ["Consulta dental", "Diagnostico", "Tratamientos"],
        },
        {
            "title": "Ortodoncista",
            "base_salary": (70000, 130000),
            "must_haves": ["Especialidad en ortodoncia", "Board certified", "Brackets/Invisalign"],
            "nice_to_haves": ["Digital", "Lingual", "ATM"],
            "responsibilities": ["Diagnostico ortodontico", "Plan de tratamiento", "Seguimiento"],
        },
        {
            "title": "Endodoncista",
            "base_salary": (65000, 120000),
            "must_haves": ["Especialidad en endodoncia", "Tratamiento de conductos", "Microscopia"],
            "nice_to_haves": ["Retratamientos", "Cirugia apical", "Digital"],
            "responsibilities": ["Tratamientos de conductos", "Retratamientos", "Emergencias"],
        },
        {
            "title": "Periodoncista",
            "base_salary": (60000, 110000),
            "must_haves": ["Especialidad en periodoncia", "Cirugia periodontal", "Implantes"],
            "nice_to_haves": ["Regeneracion", "Estetica gingival", "Laser"],
            "responsibilities": ["Tratamiento periodontal", "Implantes", "Mantenimiento"],
        },
        {
            "title": "Higienista Dental",
            "base_salary": (18000, 32000),
            "must_haves": ["Tecnico en higiene dental", "Profilaxis", "Educacion oral"],
            "nice_to_haves": ["Radiografias", "Blanqueamiento", "Selladores"],
            "responsibilities": ["Limpiezas dentales", "Educacion al paciente", "Apoyo clinico"],
        },
        {
            "title": "Asistente Dental",
            "base_salary": (15000, 25000),
            "must_haves": ["Certificacion asistente dental", "Instrumentacion", "Esterilizacion"],
            "nice_to_haves": ["Radiografias", "Recepcion", "Software dental"],
            "responsibilities": ["Asistencia en procedimientos", "Esterilizacion", "Preparacion"],
        },
        {
            "title": "Cirujano Maxilofacial",
            "base_salary": (90000, 180000),
            "must_haves": ["Especialidad en cirugia maxilofacial", "Cirugia oral", "Implantes"],
            "nice_to_haves": ["Trauma", "Ortognatica", "Reconstruccion"],
            "responsibilities": ["Cirugias complejas", "Extracciones", "Implantes"],
        },
        {
            "title": "Odontopediatra",
            "base_salary": (55000, 100000),
            "must_haves": ["Especialidad en odontopediatria", "Manejo de conducta", "Sedacion"],
            "nice_to_haves": ["Pacientes especiales", "Ortopedia", "Prevencion"],
            "responsibilities": ["Atencion infantil", "Prevencion", "Educacion a padres"],
        },
    ],
    JobCategory.ADMINISTRATION: [
        {
            "title": "Asistente Administrativo",
            "base_salary": (18000, 30000),
            "must_haves": ["Preparatoria/Licenciatura", "Office", "Organizacion"],
            "nice_to_haves": ["Ingles", "ERP", "Atencion al cliente"],
            "responsibilities": ["Apoyo administrativo", "Agenda", "Documentacion"],
        },
        {
            "title": "Asistente de Dirección",
            "base_salary": (25000, 45000),
            "must_haves": ["Licenciatura", "Asistencia ejecutiva", "Ingles"],
            "nice_to_haves": ["Viajes", "Eventos", "Presentaciones"],
            "responsibilities": ["Apoyo a direccion", "Coordinacion de agenda", "Viajes"],
        },
        {
            "title": "Recepcionista",
            "base_salary": (15000, 25000),
            "must_haves": ["Preparatoria", "Atencion al publico", "Telefono"],
            "nice_to_haves": ["Ingles", "Conmutador", "Presentacion"],
            "responsibilities": ["Atencion a visitantes", "Conmutador", "Correspondencia"],
        },
        {
            "title": "Gerente Administrativo",
            "base_salary": (50000, 85000),
            "must_haves": ["Licenciatura", "Gestion administrativa", "Presupuestos"],
            "nice_to_haves": ["MBA", "Compras", "Facilities"],
            "responsibilities": ["Administracion general", "Proveedores", "Instalaciones"],
        },
        {
            "title": "Coordinador de Compras",
            "base_salary": (35000, 55000),
            "must_haves": ["Licenciatura", "Compras", "Negociacion"],
            "nice_to_haves": ["Supply chain", "Contratos", "SAP"],
            "responsibilities": ["Gestion de compras", "Proveedores", "Negociacion"],
        },
        {
            "title": "Auxiliar de Oficina",
            "base_salary": (12000, 20000),
            "must_haves": ["Preparatoria", "Organizacion", "Archivo"],
            "nice_to_haves": ["Office", "Mensajeria", "Atencion"],
            "responsibilities": ["Archivo", "Mensajeria", "Apoyo general"],
        },
    ],
    JobCategory.SALES: [
        {
            "title": "Ejecutivo de Ventas",
            "base_salary": (25000, 50000),
            "must_haves": ["Licenciatura", "Ventas", "Negociacion"],
            "nice_to_haves": ["CRM", "B2B", "Ingles"],
            "responsibilities": ["Prospeccion", "Cierre de ventas", "Seguimiento"],
        },
        {
            "title": "Gerente de Ventas",
            "base_salary": (60000, 110000),
            "must_haves": ["Licenciatura", "Liderazgo de ventas", "Estrategia comercial"],
            "nice_to_haves": ["MBA", "KPIs", "Salesforce"],
            "responsibilities": ["Direccion del equipo", "Forecast", "Estrategia"],
        },
        {
            "title": "Key Account Manager",
            "base_salary": (50000, 90000),
            "must_haves": ["Licenciatura", "Cuentas clave", "Negociacion"],
            "nice_to_haves": ["B2B", "Retail", "Ingles"],
            "responsibilities": ["Gestion de cuentas clave", "Desarrollo de negocio", "Relaciones"],
        },
        {
            "title": "Inside Sales Representative",
            "base_salary": (20000, 40000),
            "must_haves": ["Preparatoria/Licenciatura", "Ventas telefonicas", "CRM"],
            "nice_to_haves": ["Ingles", "SaaS", "Lead generation"],
            "responsibilities": ["Ventas telefonicas", "Seguimiento", "Pipeline"],
        },
        {
            "title": "Director Comercial",
            "base_salary": (120000, 200000),
            "must_haves": ["Licenciatura/MBA", "Direccion comercial", "Estrategia"],
            "nice_to_haves": ["Internacional", "P&L", "M&A"],
            "responsibilities": ["Estrategia comercial", "P&L", "Expansion"],
        },
        {
            "title": "Representante de Ventas de Campo",
            "base_salary": (28000, 55000),
            "must_haves": ["Licenciatura", "Ventas en campo", "Prospeccion"],
            "nice_to_haves": ["Auto propio", "Ruta", "Demostraciones"],
            "responsibilities": ["Visitas a clientes", "Demostraciones", "Cierre"],
        },
    ],
    JobCategory.MARKETING: [
        {
            "title": "Especialista en Marketing Digital",
            "base_salary": (35000, 65000),
            "must_haves": ["Marketing", "Google Ads", "Facebook Ads", "Analytics"],
            "nice_to_haves": ["SEO", "Email marketing", "Automation"],
            "responsibilities": ["Campanas digitales", "Analisis de metricas", "Optimizacion"],
        },
        {
            "title": "Community Manager",
            "base_salary": (22000, 40000),
            "must_haves": ["Comunicacion/Marketing", "Redes sociales", "Copywriting"],
            "nice_to_haves": ["Diseno basico", "Influencers", "Crisis"],
            "responsibilities": ["Gestion de redes", "Contenido", "Engagement"],
        },
        {
            "title": "Gerente de Marketing",
            "base_salary": (60000, 100000),
            "must_haves": ["Licenciatura", "Estrategia de marketing", "Presupuestos"],
            "nice_to_haves": ["MBA", "Branding", "Trade marketing"],
            "responsibilities": ["Estrategia de marca", "Campanas", "Budget"],
        },
        {
            "title": "Content Manager",
            "base_salary": (35000, 60000),
            "must_haves": ["Comunicacion/Marketing", "Creacion de contenido", "SEO"],
            "nice_to_haves": ["Video", "Podcast", "Storytelling"],
            "responsibilities": ["Estrategia de contenido", "Produccion", "Calendario editorial"],
        },
        {
            "title": "Brand Manager",
            "base_salary": (55000, 90000),
            "must_haves": ["Marketing", "Gestion de marca", "Consumer insights"],
            "nice_to_haves": ["CPG", "Innovation", "Research"],
            "responsibilities": ["Estrategia de marca", "Lanzamientos", "P&L de marca"],
        },
        {
            "title": "Diseñador Gráfico",
            "base_salary": (25000, 50000),
            "must_haves": ["Diseno grafico", "Adobe Suite", "Creatividad"],
            "nice_to_haves": ["Motion graphics", "UI", "3D"],
            "responsibilities": ["Diseno de materiales", "Branding", "Digital assets"],
        },
        {
            "title": "SEO Specialist",
            "base_salary": (35000, 65000),
            "must_haves": ["Marketing digital", "SEO tecnico", "Analytics"],
            "nice_to_haves": ["SEM", "Content", "Link building"],
            "responsibilities": ["Optimizacion SEO", "Auditorias", "Estrategia de contenido"],
        },
    ],
    JobCategory.HUMAN_RESOURCES: [
        {
            "title": "Reclutador/a",
            "base_salary": (25000, 45000),
            "must_haves": ["Psicologia/RH", "Reclutamiento", "Entrevistas"],
            "nice_to_haves": ["Tech recruiting", "LinkedIn", "ATS"],
            "responsibilities": ["Proceso de seleccion", "Sourcing", "Entrevistas"],
        },
        {
            "title": "Generalista de RH",
            "base_salary": (35000, 60000),
            "must_haves": ["Licenciatura RH/Psicologia", "Nominas", "Legislacion laboral"],
            "nice_to_haves": ["Capacitacion", "DO", "Compensaciones"],
            "responsibilities": ["Administracion de personal", "Relaciones laborales", "Nominas"],
        },
        {
            "title": "Gerente de Recursos Humanos",
            "base_salary": (70000, 120000),
            "must_haves": ["Licenciatura/Maestria RH", "Gestion de talento", "Estrategia RH"],
            "nice_to_haves": ["Change management", "HRIS", "Coaching"],
            "responsibilities": ["Estrategia de RH", "Desarrollo organizacional", "Cultura"],
        },
        {
            "title": "Especialista en Capacitación",
            "base_salary": (35000, 55000),
            "must_haves": ["Pedagogia/RH", "Diseno instruccional", "Facilitacion"],
            "nice_to_haves": ["E-learning", "LMS", "Certificaciones"],
            "responsibilities": ["Programas de capacitacion", "Facilitacion", "Evaluacion"],
        },
        {
            "title": "Compensation & Benefits Manager",
            "base_salary": (65000, 110000),
            "must_haves": ["RH/Finanzas", "Compensaciones", "Benchmarking"],
            "nice_to_haves": ["Equity", "Global mobility", "Analytics"],
            "responsibilities": ["Estrategia de compensaciones", "Benchmarks", "Politicas"],
        },
        {
            "title": "HR Business Partner",
            "base_salary": (55000, 90000),
            "must_haves": ["RH", "Business partnering", "Consultoria interna"],
            "nice_to_haves": ["Coaching", "Analytics", "Change management"],
            "responsibilities": ["Asesoria a lideres", "Desarrollo organizacional", "Talento"],
        },
    ],
    JobCategory.CUSTOMER_SERVICE: [
        {
            "title": "Representante de Servicio al Cliente",
            "base_salary": (15000, 28000),
            "must_haves": ["Preparatoria", "Atencion al cliente", "Comunicacion"],
            "nice_to_haves": ["Ingles", "CRM", "Call center"],
            "responsibilities": ["Atencion a clientes", "Resolucion de problemas", "Seguimiento"],
        },
        {
            "title": "Supervisor de Call Center",
            "base_salary": (30000, 50000),
            "must_haves": ["Licenciatura", "Supervision", "KPIs"],
            "nice_to_haves": ["Coaching", "WFM", "Quality"],
            "responsibilities": ["Supervision de equipo", "Metricas", "Coaching"],
        },
        {
            "title": "Customer Success Manager",
            "base_salary": (45000, 80000),
            "must_haves": ["Licenciatura", "Customer success", "Retencion"],
            "nice_to_haves": ["SaaS", "Upselling", "Analytics"],
            "responsibilities": ["Exito del cliente", "Onboarding", "Retencion"],
        },
        {
            "title": "Agente Bilingüe de Soporte",
            "base_salary": (22000, 38000),
            "must_haves": ["Ingles avanzado", "Soporte tecnico", "Comunicacion"],
            "nice_to_haves": ["Helpdesk", "Ticketing", "Tech support"],
            "responsibilities": ["Soporte en ingles", "Resolucion de tickets", "Escalaciones"],
        },
        {
            "title": "Gerente de Experiencia del Cliente",
            "base_salary": (60000, 100000),
            "must_haves": ["Licenciatura", "CX", "Customer journey"],
            "nice_to_haves": ["NPS", "Voice of customer", "Analytics"],
            "responsibilities": ["Estrategia CX", "Mejora de experiencia", "Metricas"],
        },
    ],
    JobCategory.LOGISTICS: [
        {
            "title": "Coordinador de Logística",
            "base_salary": (30000, 50000),
            "must_haves": ["Licenciatura", "Logistica", "Supply chain"],
            "nice_to_haves": ["SAP", "Comercio exterior", "WMS"],
            "responsibilities": ["Coordinacion de envios", "Inventarios", "Proveedores"],
        },
        {
            "title": "Almacenista",
            "base_salary": (15000, 25000),
            "must_haves": ["Preparatoria", "Inventarios", "Montacargas"],
            "nice_to_haves": ["SAP", "5S", "Picking"],
            "responsibilities": ["Recepcion de materiales", "Inventarios", "Surtido"],
        },
        {
            "title": "Gerente de Supply Chain",
            "base_salary": (80000, 140000),
            "must_haves": ["Ingenieria/MBA", "Supply chain", "S&OP"],
            "nice_to_haves": ["APICS", "Lean", "Internacional"],
            "responsibilities": ["Estrategia de supply chain", "S&OP", "Costos"],
        },
        {
            "title": "Analista de Comercio Exterior",
            "base_salary": (35000, 55000),
            "must_haves": ["Comercio exterior", "Aduanas", "Incoterms"],
            "nice_to_haves": ["IMMEX", "Certificacion OEA", "Clasificacion arancelaria"],
            "responsibilities": ["Tramites aduanales", "Cumplimiento", "Importaciones/Exportaciones"],
        },
        {
            "title": "Operador de Transporte",
            "base_salary": (18000, 30000),
            "must_haves": ["Licencia tipo E", "Manejo de trailer", "Logistica"],
            "nice_to_haves": ["GPS", "Bitacora", "Materiales peligrosos"],
            "responsibilities": ["Transporte de mercancia", "Documentacion", "Seguridad vial"],
        },
        {
            "title": "Planeador de Demanda",
            "base_salary": (40000, 70000),
            "must_haves": ["Ingenieria/Administracion", "Forecasting", "S&OP"],
            "nice_to_haves": ["SAP APO", "Machine learning", "Excel avanzado"],
            "responsibilities": ["Pronostico de demanda", "Inventarios", "S&OP"],
        },
    ],
    JobCategory.EDUCATION: [
        {
            "title": "Profesor/a de Preparatoria",
            "base_salary": (20000, 40000),
            "must_haves": ["Licenciatura en area", "Docencia", "Pedagogia"],
            "nice_to_haves": ["Maestria", "SEP", "Bilingue"],
            "responsibilities": ["Impartir clases", "Evaluacion", "Planeacion didactica"],
        },
        {
            "title": "Coordinador Académico",
            "base_salary": (35000, 60000),
            "must_haves": ["Licenciatura/Maestria", "Gestion academica", "Liderazgo"],
            "nice_to_haves": ["Curriculum", "Acreditaciones", "Tecnologia educativa"],
            "responsibilities": ["Coordinacion de programas", "Docentes", "Calidad academica"],
        },
        {
            "title": "Diseñador Instruccional",
            "base_salary": (30000, 55000),
            "must_haves": ["Pedagogia/Comunicacion", "E-learning", "Diseno instruccional"],
            "nice_to_haves": ["Articulate", "LMS", "Video"],
            "responsibilities": ["Diseno de cursos", "Materiales didacticos", "Evaluacion"],
        },
        {
            "title": "Director/a de Escuela",
            "base_salary": (60000, 100000),
            "must_haves": ["Maestria en educacion", "Gestion escolar", "Liderazgo"],
            "nice_to_haves": ["SEP", "Certificaciones", "Bilingue"],
            "responsibilities": ["Direccion de plantel", "Padres de familia", "Autoridades"],
        },
        {
            "title": "Tutor/a Online",
            "base_salary": (15000, 30000),
            "must_haves": ["Licenciatura", "Tutorias", "Plataformas online"],
            "nice_to_haves": ["Ingles", "Matematicas", "Ciencias"],
            "responsibilities": ["Sesiones de tutoria", "Seguimiento", "Retroalimentacion"],
        },
    ],
    JobCategory.RESEARCH: [
        {
            "title": "Científico de Investigación",
            "base_salary": (50000, 90000),
            "must_haves": ["Doctorado", "Metodologia de investigacion", "Publicaciones"],
            "nice_to_haves": ["Grants", "Laboratorio", "Colaboraciones"],
            "responsibilities": ["Proyectos de investigacion", "Publicaciones", "Mentoria"],
        },
        {
            "title": "Asistente de Investigación",
            "base_salary": (25000, 40000),
            "must_haves": ["Licenciatura/Maestria", "Investigacion", "Analisis de datos"],
            "nice_to_haves": ["Estadistica", "SPSS/R", "Laboratorio"],
            "responsibilities": ["Apoyo en investigacion", "Recoleccion de datos", "Analisis"],
        },
        {
            "title": "Investigador/a Clínico/a",
            "base_salary": (45000, 80000),
            "must_haves": ["Medicina/Biologia", "Investigacion clinica", "GCP"],
            "nice_to_haves": ["Farmacovigilancia", "Ensayos clinicos", "Regulatorio"],
            "responsibilities": ["Estudios clinicos", "Protocolos", "Monitoreo"],
        },
        {
            "title": "Analista de Datos de Investigación",
            "base_salary": (40000, 70000),
            "must_haves": ["Estadistica/Ciencias", "Analisis de datos", "R/Python"],
            "nice_to_haves": ["Machine learning", "Publicaciones", "Visualizacion"],
            "responsibilities": ["Analisis estadistico", "Reportes", "Metodologia"],
        },
        {
            "title": "Director/a de I+D",
            "base_salary": (100000, 180000),
            "must_haves": ["Doctorado", "Direccion de I+D", "Innovacion"],
            "nice_to_haves": ["Patentes", "Partnerships", "Grants"],
            "responsibilities": ["Estrategia de I+D", "Portafolio de proyectos", "Innovacion"],
        },
    ],
    JobCategory.CONSTRUCTION: [
        {
            "title": "Ingeniero Civil de Obra",
            "base_salary": (40000, 75000),
            "must_haves": ["Ingenieria civil", "Supervision de obra", "AutoCAD"],
            "nice_to_haves": ["Revit", "Project management", "Presupuestos"],
            "responsibilities": ["Supervision de construccion", "Control de calidad", "Reportes"],
        },
        {
            "title": "Arquitecto/a",
            "base_salary": (35000, 70000),
            "must_haves": ["Arquitectura", "AutoCAD", "Diseno"],
            "nice_to_haves": ["Revit", "SketchUp", "Renders"],
            "responsibilities": ["Diseno arquitectonico", "Planos", "Supervision"],
        },
        {
            "title": "Residente de Obra",
            "base_salary": (35000, 60000),
            "must_haves": ["Ingenieria/Arquitectura", "Residencia de obra", "Control de avance"],
            "nice_to_haves": ["MS Project", "Presupuestos", "Neodata"],
            "responsibilities": ["Control de obra", "Bitacora", "Contratistas"],
        },
        {
            "title": "Gerente de Construcción",
            "base_salary": (80000, 140000),
            "must_haves": ["Ingenieria/Arquitectura", "Gestion de proyectos", "Liderazgo"],
            "nice_to_haves": ["PMP", "MBA", "LEED"],
            "responsibilities": ["Direccion de proyectos", "Presupuestos", "Clientes"],
        },
        {
            "title": "Topógrafo",
            "base_salary": (25000, 45000),
            "must_haves": ["Topografia", "Levantamientos", "GPS"],
            "nice_to_haves": ["Drones", "Civil 3D", "Georeferenciacion"],
            "responsibilities": ["Levantamientos topograficos", "Planos", "Trazo"],
        },
        {
            "title": "Maestro de Obra",
            "base_salary": (25000, 40000),
            "must_haves": ["Experiencia en construccion", "Lectura de planos", "Supervision"],
            "nice_to_haves": ["Acabados", "Estructuras", "Instalaciones"],
            "responsibilities": ["Supervision de cuadrillas", "Control de materiales", "Calidad"],
        },
    ],
    JobCategory.HOSPITALITY: [
        {
            "title": "Gerente de Hotel",
            "base_salary": (50000, 90000),
            "must_haves": ["Hoteleria/Turismo", "Gestion hotelera", "Liderazgo"],
            "nice_to_haves": ["Ingles", "Opera PMS", "Revenue management"],
            "responsibilities": ["Operacion del hotel", "Guest satisfaction", "P&L"],
        },
        {
            "title": "Recepcionista de Hotel",
            "base_salary": (15000, 28000),
            "must_haves": ["Preparatoria", "Atencion al huesped", "Ingles basico"],
            "nice_to_haves": ["Opera", "Ingles avanzado", "Otros idiomas"],
            "responsibilities": ["Check-in/out", "Reservaciones", "Atencion a huespedes"],
        },
        {
            "title": "Chef Ejecutivo",
            "base_salary": (45000, 85000),
            "must_haves": ["Gastronomia", "Direccion de cocina", "Creatividad"],
            "nice_to_haves": ["Cocina internacional", "Pasteleria", "Costos"],
            "responsibilities": ["Direccion de cocina", "Menu", "Control de costos"],
        },
        {
            "title": "Mesero/a",
            "base_salary": (12000, 22000),
            "must_haves": ["Experiencia en servicio", "Atencion al cliente", "Presentacion"],
            "nice_to_haves": ["Vinos", "Ingles", "Protocolo"],
            "responsibilities": ["Servicio de alimentos", "Atencion al comensal", "Limpieza"],
        },
        {
            "title": "Housekeeping Manager",
            "base_salary": (30000, 50000),
            "must_haves": ["Hoteleria", "Supervision", "Estandares de limpieza"],
            "nice_to_haves": ["Opera", "Ingles", "Inventarios"],
            "responsibilities": ["Supervision de habitaciones", "Estandares", "Personal"],
        },
        {
            "title": "Bartender",
            "base_salary": (15000, 28000),
            "must_haves": ["Mixologia", "Cocteleria", "Servicio al cliente"],
            "nice_to_haves": ["Ingles", "Inventarios", "Creatividad"],
            "responsibilities": ["Preparacion de bebidas", "Atencion en barra", "Inventarios"],
        },
    ],
    JobCategory.RETAIL: [
        {
            "title": "Vendedor/a de Piso",
            "base_salary": (12000, 22000),
            "must_haves": ["Preparatoria", "Ventas", "Atencion al cliente"],
            "nice_to_haves": ["Producto especifico", "Inventarios", "Caja"],
            "responsibilities": ["Ventas", "Atencion al cliente", "Acomodo"],
        },
        {
            "title": "Gerente de Tienda",
            "base_salary": (35000, 60000),
            "must_haves": ["Licenciatura", "Gestion de retail", "Liderazgo"],
            "nice_to_haves": ["Visual merchandising", "Inventarios", "KPIs"],
            "responsibilities": ["Operacion de tienda", "Equipo", "Ventas"],
        },
        {
            "title": "Visual Merchandiser",
            "base_salary": (25000, 45000),
            "must_haves": ["Diseno/Mercadotecnia", "Visual merchandising", "Creatividad"],
            "nice_to_haves": ["Retail", "Escaparatismo", "Photoshop"],
            "responsibilities": ["Exhibicion de productos", "Layout de tienda", "Temporadas"],
        },
        {
            "title": "Cajero/a",
            "base_salary": (12000, 18000),
            "must_haves": ["Preparatoria", "Manejo de efectivo", "Atencion al cliente"],
            "nice_to_haves": ["Sistema POS", "Facturacion", "Inventarios"],
            "responsibilities": ["Cobro", "Atencion al cliente", "Arqueo"],
        },
        {
            "title": "District Manager Retail",
            "base_salary": (70000, 120000),
            "must_haves": ["Licenciatura", "Gestion multi-tienda", "P&L"],
            "nice_to_haves": ["MBA", "Expansion", "Franquicias"],
            "responsibilities": ["Supervision de zona", "KPIs", "Desarrollo de equipo"],
        },
        {
            "title": "Comprador/a de Retail",
            "base_salary": (40000, 70000),
            "must_haves": ["Mercadotecnia/Negocios", "Compras", "Analisis de tendencias"],
            "nice_to_haves": ["Moda", "OTB", "Negociacion internacional"],
            "responsibilities": ["Seleccion de producto", "Negociacion", "Forecast"],
        },
    ],
    JobCategory.ENGINEERING: [
        {
            "title": "Ingeniero Mecánico",
            "base_salary": (40000, 75000),
            "must_haves": ["Ingenieria mecanica", "AutoCAD", "Diseno mecanico"],
            "nice_to_haves": ["SolidWorks", "GD&T", "FEA"],
            "responsibilities": ["Diseno de componentes", "Analisis", "Prototipos"],
        },
        {
            "title": "Ingeniero Eléctrico",
            "base_salary": (42000, 78000),
            "must_haves": ["Ingenieria electrica", "Sistemas electricos", "AutoCAD Electrical"],
            "nice_to_haves": ["PLC", "SCADA", "Alta tension"],
            "responsibilities": ["Diseno electrico", "Instalaciones", "Mantenimiento"],
        },
        {
            "title": "Ingeniero de Automatización",
            "base_salary": (50000, 90000),
            "must_haves": ["Ingenieria", "PLC", "Automatizacion industrial"],
            "nice_to_haves": ["Robotica", "SCADA", "Industry 4.0"],
            "responsibilities": ["Programacion de PLC", "Integracion de sistemas", "Commissioning"],
        },
        {
            "title": "Ingeniero de Proyectos",
            "base_salary": (45000, 80000),
            "must_haves": ["Ingenieria", "Project management", "MS Project"],
            "nice_to_haves": ["PMP", "AutoCAD", "Presupuestos"],
            "responsibilities": ["Gestion de proyectos", "Cronogramas", "Costos"],
        },
        {
            "title": "Ingeniero de Diseño CAD",
            "base_salary": (35000, 60000),
            "must_haves": ["Ingenieria/Diseno", "SolidWorks", "AutoCAD"],
            "nice_to_haves": ["CATIA", "NX", "Rendering"],
            "responsibilities": ["Modelado 3D", "Planos", "Documentacion tecnica"],
        },
        {
            "title": "Ingeniero Químico",
            "base_salary": (45000, 80000),
            "must_haves": ["Ingenieria quimica", "Procesos quimicos", "Balance de materia"],
            "nice_to_haves": ["Aspen", "Six Sigma", "Pharma"],
            "responsibilities": ["Diseno de procesos", "Scale-up", "Optimizacion"],
        },
        {
            "title": "Gerente de Ingeniería",
            "base_salary": (90000, 150000),
            "must_haves": ["Ingenieria", "Gestion de equipos", "Proyectos"],
            "nice_to_haves": ["MBA", "PMP", "Lean"],
            "responsibilities": ["Direccion de ingenieria", "Innovacion", "Presupuestos"],
        },
    ],
}

# Locations for variety
LOCATIONS = [
    ("Ciudad de Mexico, CDMX", "Mexico"),
    ("Guadalajara, Jalisco", "Mexico"),
    ("Monterrey, Nuevo Leon", "Mexico"),
    ("Queretaro, Queretaro", "Mexico"),
    ("Tijuana, Baja California", "Mexico"),
    ("Puebla, Puebla", "Mexico"),
    ("Leon, Guanajuato", "Mexico"),
    ("Merida, Yucatan", "Mexico"),
    ("Cancun, Quintana Roo", "Mexico"),
    ("Bogota", "Colombia"),
    ("Medellin", "Colombia"),
    ("Buenos Aires", "Argentina"),
    ("Santiago", "Chile"),
    ("Lima", "Peru"),
    ("Sao Paulo", "Brasil"),
    ("Remote - LATAM", "LATAM"),
    ("Remote - Mexico", "Mexico"),
    ("Remote - Anywhere", "Global"),
]

# Benefits pool
BENEFITS = [
    "Trabajo remoto / Home office",
    "Horario flexible",
    "Seguro de gastos medicos mayores",
    "Seguro de vida",
    "Fondo de ahorro",
    "Vales de despensa",
    "Bono anual",
    "Stock options",
    "Dias de vacaciones adicionales",
    "Capacitacion y desarrollo",
    "Gimnasio o wellness",
    "Comedor subsidiado",
    "Transporte / Gasolina",
    "Guarderia",
    "Seguro dental",
    "Plan de carrera",
    "Licencia de paternidad extendida",
    "Viernes corto",
    "Dia de cumpleanos libre",
    "Budget para equipo de trabajo",
]


def get_or_create_company(db: Session, data: dict) -> Company:
    """Get or create a company."""
    company = db.query(Company).filter(Company.slug == data["slug"]).first()
    if company:
        return company

    company = Company(
        id=uuid4(),
        name=data["name"],
        slug=data["slug"],
        description=data["description"],
        industry=data["industry"],
        size=data["size"],
        website=f"https://{data['slug']}.com",
        is_active=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(company)
    db.flush()
    return company


def get_or_create_employer(db: Session, company: Company) -> User:
    """Get or create an employer user for a company."""
    email = f"hr@{company.slug}.com"
    user = db.query(User).filter(User.email == email).first()
    if user:
        return user

    from app.core.security import get_password_hash
    user = User(
        id=uuid4(),
        email=email,
        hashed_password=get_password_hash("Employer123!"),
        full_name=f"HR Manager - {company.name}",
        role=UserRole.EMPLOYER,
        company_id=company.id,
        is_active=True,
        is_verified=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(user)
    db.flush()
    return user


def get_rubric(db: Session) -> Rubric:
    """Get default rubric."""
    rubric = db.query(Rubric).filter(Rubric.is_default == True).first()
    return rubric


def generate_description(template: dict, category: JobCategory, seniority: SeniorityLevel) -> str:
    """Generate a job description from template."""
    seniority_text = {
        SeniorityLevel.INTERN: "practicante",
        SeniorityLevel.JUNIOR: "junior (0-2 anos de experiencia)",
        SeniorityLevel.MID: "mid-level (2-5 anos de experiencia)",
        SeniorityLevel.SENIOR: "senior (5+ anos de experiencia)",
        SeniorityLevel.LEAD: "lead/principal (7+ anos de experiencia)",
        SeniorityLevel.MANAGER: "gerente/manager",
        SeniorityLevel.DIRECTOR: "director",
        SeniorityLevel.VP: "VP / Vicepresidente",
        SeniorityLevel.C_LEVEL: "C-Level / Ejecutivo",
    }

    must_haves_text = "\n".join([f"- {req}" for req in template["must_haves"]])
    nice_to_haves_text = "\n".join([f"- {req}" for req in template["nice_to_haves"]])
    responsibilities_text = "\n".join([f"- {resp}" for resp in template["responsibilities"]])

    return f"""Buscamos un(a) {template['title']} nivel {seniority_text[seniority]} para unirse a nuestro equipo.

## Responsabilidades
{responsibilities_text}
- Colaborar con equipos multidisciplinarios
- Participar en mejora continua de procesos
- Documentar y comunicar avances

## Requisitos Obligatorios
{must_haves_text}

## Requisitos Deseables
{nice_to_haves_text}

## Que Ofrecemos
- Ambiente de trabajo dinamico y colaborativo
- Oportunidades de crecimiento profesional
- Compensacion competitiva
- Beneficios superiores a los de ley

Si cumples con el perfil y te interesa formar parte de nuestro equipo, aplica ahora!
"""


def adjust_salary_for_seniority(base_min: int, base_max: int, seniority: SeniorityLevel) -> tuple:
    """Adjust salary based on seniority level."""
    multipliers = {
        SeniorityLevel.INTERN: (0.3, 0.4),
        SeniorityLevel.JUNIOR: (0.5, 0.7),
        SeniorityLevel.MID: (1.0, 1.0),
        SeniorityLevel.SENIOR: (1.3, 1.5),
        SeniorityLevel.LEAD: (1.5, 1.8),
        SeniorityLevel.MANAGER: (1.7, 2.0),
        SeniorityLevel.DIRECTOR: (2.0, 2.5),
        SeniorityLevel.VP: (2.5, 3.0),
        SeniorityLevel.C_LEVEL: (3.0, 4.0),
    }
    mult = multipliers[seniority]
    return (int(base_min * mult[0]), int(base_max * mult[1]))


def seed_massive_jobs():
    """Seed 300+ diverse jobs."""
    db = SessionLocal()

    try:
        print("=" * 70)
        print("TALENTOS BY BLOQUE - MASSIVE JOB SEED")
        print("=" * 70)

        # Get or create rubric first
        rubric = get_rubric(db)
        if not rubric:
            print("\nERROR: No default rubric found. Run seed.py first!")
            return

        # Create all companies and employers
        print("\n[1/2] Creating companies and employers...")
        companies_map = {}
        employers_map = {}

        for comp_data in COMPANIES:
            company = get_or_create_company(db, comp_data)
            companies_map[comp_data["slug"]] = company
            employer = get_or_create_employer(db, company)
            employers_map[comp_data["slug"]] = employer
            print(f"  - {company.name}")

        db.commit()

        # Map categories to companies (based on industry)
        category_to_companies = {
            JobCategory.TECHNOLOGY: ["technova-solutions", "bioresearch-labs", "edutech-academy"],
            JobCategory.HEALTHCARE: ["medicare-plus", "sonrisas-dental"],
            JobCategory.LEGAL: ["legal-partners", "banco-financiero"],
            JobCategory.MANUFACTURING: ["industriamex", "constructora-horizonte"],
            JobCategory.FINANCE: ["banco-financiero", "legal-partners"],
            JobCategory.DENTAL: ["sonrisas-dental", "medicare-plus"],
            JobCategory.ADMINISTRATION: ["banco-financiero", "retailmax", "hotel-paraiso"],
            JobCategory.SALES: ["retailmax", "industriamex", "technova-solutions"],
            JobCategory.MARKETING: ["retailmax", "technova-solutions", "edutech-academy"],
            JobCategory.HUMAN_RESOURCES: ["banco-financiero", "industriamex", "medicare-plus"],
            JobCategory.CUSTOMER_SERVICE: ["retailmax", "banco-financiero", "technova-solutions"],
            JobCategory.LOGISTICS: ["logitrans-express", "industriamex", "retailmax"],
            JobCategory.EDUCATION: ["edutech-academy", "medicare-plus"],
            JobCategory.RESEARCH: ["bioresearch-labs", "medicare-plus"],
            JobCategory.CONSTRUCTION: ["constructora-horizonte", "industriamex"],
            JobCategory.HOSPITALITY: ["hotel-paraiso", "retailmax"],
            JobCategory.RETAIL: ["retailmax", "hotel-paraiso"],
            JobCategory.ENGINEERING: ["industriamex", "technova-solutions", "constructora-horizonte"],
        }

        # Seniority levels to use (weighted distribution)
        seniority_weights = [
            (SeniorityLevel.INTERN, 5),
            (SeniorityLevel.JUNIOR, 20),
            (SeniorityLevel.MID, 35),
            (SeniorityLevel.SENIOR, 25),
            (SeniorityLevel.LEAD, 8),
            (SeniorityLevel.MANAGER, 5),
            (SeniorityLevel.DIRECTOR, 2),
        ]
        seniority_pool = []
        for seniority, weight in seniority_weights:
            seniority_pool.extend([seniority] * weight)

        # Modality weights
        modality_weights = [
            (JobModality.REMOTE, 40),
            (JobModality.HYBRID, 35),
            (JobModality.ONSITE, 25),
        ]
        modality_pool = []
        for modality, weight in modality_weights:
            modality_pool.extend([modality] * weight)

        # Generate jobs
        print("\n[2/2] Creating jobs...")
        job_count = 0
        jobs_created = 0

        for category, templates in JOB_TEMPLATES.items():
            company_slugs = category_to_companies.get(category, ["technova-solutions"])

            for template in templates:
                # Create multiple variations of each job template
                for variation in range(random.randint(2, 4)):  # 2-4 variations per template
                    seniority = random.choice(seniority_pool)
                    modality = random.choice(modality_pool)
                    location_data = random.choice(LOCATIONS)
                    company_slug = random.choice(company_slugs)

                    company = companies_map[company_slug]
                    employer = employers_map[company_slug]

                    # Generate title with seniority prefix sometimes
                    title = template["title"]
                    if seniority in [SeniorityLevel.SENIOR, SeniorityLevel.LEAD] and random.random() > 0.5:
                        title = f"Senior {title}"
                    elif seniority == SeniorityLevel.JUNIOR and random.random() > 0.5:
                        title = f"Junior {title}"

                    # Check if similar job exists
                    existing = (
                        db.query(Job)
                        .filter(Job.company_id == company.id)
                        .filter(Job.title == title)
                        .filter(Job.seniority == seniority)
                        .filter(Job.location == location_data[0])
                        .first()
                    )

                    if existing:
                        continue

                    # Adjust salary
                    salary_min, salary_max = adjust_salary_for_seniority(
                        template["base_salary"][0],
                        template["base_salary"][1],
                        seniority
                    )

                    # Random benefits
                    num_benefits = random.randint(5, 10)
                    job_benefits = random.sample(BENEFITS, num_benefits)

                    # Create job
                    slug = f"{title.lower().replace(' ', '-').replace('/', '-')}-{str(uuid4())[:8]}"
                    slug = slug[:100]  # Limit slug length

                    job = Job(
                        id=uuid4(),
                        company_id=company.id,
                        created_by_id=employer.id,
                        title=title,
                        slug=slug,
                        description=generate_description(template, category, seniority),
                        department=category.value.replace("_", " ").title(),
                        category=category,
                        seniority=seniority,
                        salary_min=salary_min,
                        salary_max=salary_max,
                        salary_currency="USD",
                        modality=modality,
                        location=location_data[0],
                        country=location_data[1],
                        must_haves=template["must_haves"],
                        nice_to_haves=template["nice_to_haves"],
                        responsibilities=template["responsibilities"],
                        benefits=job_benefits,
                        status=JobStatus.ACTIVE,
                        is_featured=random.random() > 0.9,  # 10% featured
                        rubric_id=rubric.id,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow(),
                    )
                    db.add(job)
                    jobs_created += 1

                    if jobs_created % 50 == 0:
                        print(f"  Created {jobs_created} jobs...")
                        db.commit()

                job_count += 1

        db.commit()

        # Print summary
        total_jobs = db.query(Job).count()
        print("\n" + "=" * 70)
        print("MASSIVE JOB SEED COMPLETED!")
        print("=" * 70)
        print(f"\nJobs created in this run: {jobs_created}")
        print(f"Total jobs in database: {total_jobs}")
        print("\nJobs by category:")
        print("-" * 40)

        for category in JobCategory:
            count = db.query(Job).filter(Job.category == category).count()
            if count > 0:
                print(f"  {category.value:25} {count:4} jobs")

        print("-" * 40)
        print("\nTest employer accounts (password: Employer123!):")
        for slug, company in companies_map.items():
            print(f"  hr@{slug}.com")

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_massive_jobs()
