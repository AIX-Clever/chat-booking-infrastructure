# Infrastructure as Code — SaaS Agentic Booking Chat

Este repositorio contiene toda la infraestructura como código (IaC) para desplegar el sistema en AWS.

## 📁 Estructura del proyecto

```
infrastructure/
├── cdk/                     # AWS CDK (TypeScript)
│   ├── bin/
│   │   └── app.ts
│   ├── lib/
│   │   ├── database-stack.ts
│   │   ├── api-stack.ts
│   │   ├── auth-stack.ts
│   │   ├── lambda-stack.ts
│   │   └── cdn-stack.ts
│   ├── package.json
│   └── cdk.json
│
├── serverless/              # Serverless Framework (alternativa)
│   ├── serverless.yml
│   ├── resources/
│   │   ├── dynamodb.yml
│   │   ├── appsync.yml
│   │   └── cognito.yml
│   └── package.json
│
├── terraform/               # Terraform (opcional)
│   ├── main.tf
│   ├── variables.tf
│   └── modules/
│
└── scripts/
    ├── deploy-dev.sh
    ├── deploy-prod.sh
    └── rollback.sh
```

## 🚀 Despliegue con CDK

```bash
cd cdk
npm install
cdk bootstrap
cdk deploy --all
```

## 📚 Documentación

- [Deployment Guide](../plan/deployment/README.md)
- [Architecture](../plan/architecture/README.md)
