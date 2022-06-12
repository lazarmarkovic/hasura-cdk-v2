import * as cdk from 'aws-cdk-lib';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

export type VPCStackProps = cdk.StackProps;

export class VPC {

  public readonly vpc: Vpc;

  constructor(mainStack: cdk.Stack, id: string, props: VPCStackProps) {

    this.vpc = new Vpc(mainStack, 'hasura-vpc', {
      cidr: '10.0.0.0/16',
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Database',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
      ],
      natGateways: 0,
      maxAzs: 2,
    });
  }
}
