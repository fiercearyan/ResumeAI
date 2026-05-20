import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class PatchProfileDto {
  @IsOptional() @IsString() @MaxLength(160) fullName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(120) currentLocation?: string;
  @IsOptional() @IsUrl({ require_tld: false }) linkedinUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) githubUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) portfolioUrl?: string;
  @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @IsOptional() @IsString() @MaxLength(2000) summary?: string;
  @IsOptional() @IsString() @MaxLength(2000) achievements?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(30) languages?: string[];
}

export class ExperienceDto {
  @IsString() @MaxLength(120) company!: string;
  @IsString() @MaxLength(120) role!: string;
  @IsOptional() @IsString() @MaxLength(40) startDate?: string;
  @IsOptional() @IsString() @MaxLength(40) endDate?: string;
  @IsOptional() @IsString() @MaxLength(4000) responsibilities?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) techStack?: string[];
}

export class EducationDto {
  @IsString() @MaxLength(160) college!: string;
  @IsOptional() @IsString() @MaxLength(120) degree?: string;
  @IsOptional() @IsString() @MaxLength(120) branch?: string;
  @IsOptional() @IsString() @MaxLength(12) startYear?: string;
  @IsOptional() @IsString() @MaxLength(12) endYear?: string;
  @IsOptional() @IsString() @MaxLength(20) gpa?: string;
}

export class ProjectDto {
  @IsString() @MaxLength(120) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(40) techStack?: string[];
  @IsOptional() @IsUrl({ require_tld: false }) githubUrl?: string;
  @IsOptional() @IsUrl({ require_tld: false }) liveUrl?: string;
}

export class SkillsBulkDto {
  @IsArray() items!: Array<{ name: string; category?: string }>;
}

export class CertificationDto {
  @IsString() @MaxLength(160) name!: string;
  @IsOptional() @IsString() @MaxLength(160) issuer?: string;
  @IsOptional() @IsString() @MaxLength(40) issuedDate?: string;
  @IsOptional() @IsUrl({ require_tld: false }) credentialUrl?: string;
}
