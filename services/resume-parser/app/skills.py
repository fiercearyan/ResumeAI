"""Lightweight skill extraction: bundled taxonomy + case-insensitive token match.

Phase 1 keeps this dependency-free. Phase 2 swaps in spaCy + the full ESCO/O*NET taxonomy.
"""
from __future__ import annotations
import re
from typing import List

TAXONOMY = [
    # languages
    "Python", "JavaScript", "TypeScript", "Java", "Kotlin", "Go", "Golang", "Rust", "C", "C++",
    "C#", "Ruby", "PHP", "Swift", "Scala", "R", "MATLAB", "SQL", "Bash", "Shell", "Perl",
    "Objective-C", "Haskell", "Elixir", "Erlang", "Lua", "Dart",
    # web / frameworks
    "React", "React Native", "Next.js", "Vue", "Vue.js", "Angular", "Svelte", "Nuxt",
    "Node.js", "Express", "NestJS", "Fastify", "Deno",
    "Django", "Flask", "FastAPI", "Pyramid", "Tornado",
    "Spring", "Spring Boot", "Hibernate", "JPA", "Quarkus", "Micronaut",
    "Rails", "Sinatra", "Laravel", "Symfony",
    "ASP.NET", ".NET", ".NET Core",
    # mobile
    "iOS", "Android", "Jetpack Compose", "SwiftUI", "Flutter", "Xamarin",
    # data / ml
    "TensorFlow", "PyTorch", "Keras", "scikit-learn", "Pandas", "NumPy", "SciPy",
    "Hugging Face", "Transformers", "LangChain", "LangGraph", "LlamaIndex", "OpenAI", "Anthropic",
    "MLOps", "MLflow", "Kubeflow", "Airflow", "dbt", "Spark", "PySpark", "Hadoop", "Hive",
    "Flink", "Kafka", "Kinesis", "Snowflake", "Databricks", "BigQuery", "Redshift", "Athena",
    # databases
    "PostgreSQL", "Postgres", "MySQL", "MariaDB", "SQLite", "Oracle", "MS SQL",
    "MongoDB", "Cassandra", "DynamoDB", "CouchDB", "Redis", "Memcached",
    "Elasticsearch", "OpenSearch", "Solr", "Pinecone", "Qdrant", "Weaviate", "Milvus", "pgvector",
    "Neo4j", "ClickHouse", "TimescaleDB",
    # cloud / infra
    "AWS", "GCP", "Google Cloud", "Azure", "DigitalOcean", "Heroku", "Vercel", "Netlify",
    "Docker", "Kubernetes", "k8s", "Helm", "Terraform", "Pulumi", "Ansible", "Chef", "Puppet",
    "Linux", "Unix", "Ubuntu", "Debian", "RHEL", "CentOS",
    "CI/CD", "GitHub Actions", "GitLab CI", "Jenkins", "CircleCI", "ArgoCD", "Argo CD",
    "Prometheus", "Grafana", "Loki", "Tempo", "Datadog", "Sentry", "OpenTelemetry", "ELK",
    # frontend / UI
    "HTML", "CSS", "Sass", "SCSS", "Tailwind", "Tailwind CSS", "Bootstrap", "Material UI",
    "shadcn", "Radix", "Storybook", "Webpack", "Vite", "Turbopack", "esbuild", "Babel",
    # testing
    "Jest", "Vitest", "Mocha", "Cypress", "Playwright", "Selenium", "Puppeteer", "JUnit", "PyTest",
    "Testing Library",
    # APIs / protocols
    "REST", "GraphQL", "gRPC", "WebSocket", "OAuth", "JWT", "OpenAPI", "Swagger", "SOAP",
    # design / soft (kept short)
    "Agile", "Scrum", "Kanban", "Jira", "Confluence",
    # security
    "OWASP", "Pen Testing", "Penetration Testing", "SAST", "DAST", "SOC 2", "GDPR", "HIPAA",
    # misc tech
    "Microservices", "Serverless", "Lambda", "Cloud Functions", "EKS", "ECS", "Fargate",
    "Service Mesh", "Istio", "Linkerd", "Envoy",
    "Stripe", "Twilio", "Auth0", "Okta", "Cognito",
]


def extract_skills(text: str) -> List[str]:
    if not text:
        return []
    haystack = " " + text + " "
    found: List[str] = []
    seen = set()
    for skill in TAXONOMY:
        # word-boundary case-insensitive search; allow ASCII names.
        pattern = re.compile(r"(?<![A-Za-z0-9])" + re.escape(skill) + r"(?![A-Za-z0-9])", re.I)
        if pattern.search(haystack):
            key = skill.lower()
            if key not in seen:
                seen.add(key)
                found.append(skill)
    return found
