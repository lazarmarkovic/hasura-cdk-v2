import * as cdk from 'aws-cdk-lib';
import { Vpc, InstanceType, InstanceClass, InstanceSize, Port, Protocol, SubnetType} from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';
import { ContainerImage, Secret as ECSSecret } from 'aws-cdk-lib/aws-ecs';
import { PublicHostedZone } from 'aws-cdk-lib/aws-route53';
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, DatabaseSecret } from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { DnsValidatedCertificate } from 'aws-cdk-lib/aws-certificatemanager';


export interface HasuraProps extends cdk.StackProps {
  appName: string;
  hostedZoneId: string;
  hostedZoneName: string;
  hasuraHostname: string;
  vpc: Vpc;
  multiAz: boolean;
}

export class Hasura {
  constructor(mainStack: cdk.Stack, id: string, props: HasuraProps) {

    const hostedZone = PublicHostedZone.fromPublicHostedZoneAttributes(mainStack, 'HasuraHostedZone', {
      hostedZoneId: props.hostedZoneId,
      zoneName: props.hostedZoneName
    });

    const hasuraCert = new DnsValidatedCertificate(mainStack, 'HasuraCertificate', {
      hostedZone,
      domainName: props.hasuraHostname,
    });

    const hasuraDatabaseName = props.appName;

    const hasuraDatabase = new DatabaseInstance(mainStack, 'HasuraDatabase', {
      instanceIdentifier: props.appName,
      databaseName: hasuraDatabaseName,
      engine: DatabaseInstanceEngine.POSTGRES,
      instanceType: InstanceType.of(InstanceClass.BURSTABLE3, InstanceSize.MICRO),
      storageEncrypted: true,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_ISOLATED,
      },
      deletionProtection: false,
      multiAz: props.multiAz,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      credentials: Credentials.fromUsername("syscdk")
    });

    const hasuraUsername = 'hasura';

    const hasuraUserSecret = new DatabaseSecret(mainStack, 'HasuraDatabaseUser', {
      username: hasuraUsername,
      masterSecret: hasuraDatabase.secret,

    });
    hasuraUserSecret.attach(hasuraDatabase); // Adds DB connections information in the secret

    // Output the Endpoint Address so it can be used in post-deploy
    new cdk.CfnOutput(mainStack, 'HasuraDatabaseUserSecretArn', {
      value: hasuraUserSecret.secretArn,
    });

    new cdk.CfnOutput(mainStack, 'HasuraDatabaseMasterSecretArn', {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      value: hasuraDatabase.secret!.secretArn,
    });

    const hasuraDatabaseUrlSecret = new Secret(mainStack, 'HasuraDatabaseUrlSecret', {
      secretName: `${props.appName}-HasuraDatabaseUrl`,
    });


    new cdk.CfnOutput(mainStack, 'HasuraDatabaseUrlSecretArn', {
      value: hasuraDatabaseUrlSecret.secretArn,
    });

    const hasuraAdminSecret = new Secret(mainStack, 'HasuraAdminSecret', {
      secretName: `${props.appName}-HasuraAdminSecret`,
    });

    new cdk.CfnOutput(mainStack, 'HasuraAdminSecretArn', {
      value: hasuraAdminSecret.secretArn,
    });

    const hasuraJwtSecret = new Secret(mainStack, 'HasuraJwtSecret', {
      secretName: `${props.appName}-HasuraJWTSecret`,
    });

    new cdk.CfnOutput(mainStack, 'HasuraJwtSecretArn', {
      value: hasuraJwtSecret.secretArn,
    });


    // Create a load-balanced Fargate service and make it public
    const fargate = new ApplicationLoadBalancedFargateService(mainStack, 'HasuraFargateService', {
      serviceName: props.appName,
      vpc: props.vpc,
      cpu: 256,
      desiredCount: props.multiAz ? 2 : 1,
      taskImageOptions: {
        image: ContainerImage.fromRegistry('hasura/graphql-engine:v1.2.1'),
        containerPort: 8080,
        enableLogging: true,
        environment: {
          HASURA_GRAPHQL_ENABLE_CONSOLE: 'true',
          HASURA_GRAPHQL_PG_CONNECTIONS: '100',
          HASURA_GRAPHQL_LOG_LEVEL: 'debug',
        },
        secrets: {
          HASURA_GRAPHQL_DATABASE_URL: ECSSecret.fromSecretsManager(hasuraDatabaseUrlSecret),
          HASURA_GRAPHQL_ADMIN_SECRET: ECSSecret.fromSecretsManager(hasuraAdminSecret),
          HASURA_GRAPHQL_JWT_SECRET: ECSSecret.fromSecretsManager(hasuraJwtSecret),
        },
      },
      memoryLimitMiB: 512,
      publicLoadBalancer: true, // Default is false
      certificate: hasuraCert,
      domainName: props.hasuraHostname,
      domainZone: hostedZone,
      assignPublicIp: true,
    });

    fargate.targetGroup.configureHealthCheck({
      enabled: true,
      path: '/healthz',
      healthyHttpCodes: '200',
    });

    hasuraDatabase.connections.allowFrom(fargate.service, new Port({
      protocol: Protocol.TCP,
      stringRepresentation: 'Postgres Port',
      fromPort: 5432,
      toPort: 5432,
    }));
  }
}
