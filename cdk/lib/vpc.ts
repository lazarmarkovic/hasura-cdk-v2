import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';

export type VPCStackProps = StackProps;

export class VPC extends Stack {

  public readonly vpc: Vpc;

  constructor(scope: Construct, id: string, props: VPCStackProps) {
    super(scope, id, props);

    this.vpc = new Vpc(this, 'hasura-vpc', {
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
