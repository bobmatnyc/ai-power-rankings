import { BaseRepository } from './base-repository';
import { Company, CompaniesData } from './schemas';
import path from 'path';
import Ajv from 'ajv';
import ajvFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
ajvFormats(ajv);

const companySchema = {
  type: 'object',
  required: ['id', 'slug', 'name', 'created_at', 'updated_at'],
  properties: {
    id: { type: 'string' },
    slug: { type: 'string' },
    name: { type: 'string' },
    description: { type: ['string', 'null'] },
    website: { type: ['string', 'null'], format: 'uri' },
    founded: { type: ['string', 'null'] },
    headquarters: { type: ['string', 'null'] },
    size: { type: ['string', 'null'] },
    funding_total: { type: ['number', 'null'] },
    last_funding_round: { type: ['string', 'null'] },
    investors: { type: ['array', 'null'], items: { type: 'string' } },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' }
  }
};

const validateCompany = ajv.compile(companySchema);

export class CompaniesRepository extends BaseRepository<CompaniesData> {
  private static instance: CompaniesRepository;
  
  constructor() {
    const filePath = path.join(process.cwd(), 'data', 'json', 'companies', 'companies.json');
    const defaultData: CompaniesData = {
      companies: [],
      index: {
        byId: {},
        bySlug: {}
      },
      metadata: {
        total: 0,
        last_updated: new Date().toISOString(),
        version: '1.0.0'
      }
    };
    
    super(filePath, defaultData);
  }
  
  static getInstance(): CompaniesRepository {
    if (!CompaniesRepository.instance) {
      CompaniesRepository.instance = new CompaniesRepository();
    }
    return CompaniesRepository.instance;
  }
  
  async validate(data: CompaniesData): Promise<boolean> {
    // Validate each company
    for (const company of data.companies) {
      if (!validateCompany(company)) {
        this.logger.error('Company validation failed', {
          company: company.id,
          errors: validateCompany.errors
        });
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Get all companies
   */
  async getAll(): Promise<Company[]> {
    const data = await this.getData();
    return data.companies;
  }
  
  /**
   * Get company by ID
   */
  async getById(id: string): Promise<Company | null> {
    const data = await this.getData();
    return data.index.byId[id] || null;
  }
  
  /**
   * Get company by slug
   */
  async getBySlug(slug: string): Promise<Company | null> {
    const data = await this.getData();
    return data.index.bySlug[slug] || null;
  }
  
  /**
   * Search companies
   */
  async search(query: string): Promise<Company[]> {
    const data = await this.getData();
    const searchTerm = query.toLowerCase();
    
    return data.companies.filter(company => {
      // Check name
      if (company.name.toLowerCase().includes(searchTerm)) return true;
      
      // Check description (handle both string and rich text array)
      if (company.description) {
        let descriptionText = '';
        if (typeof company.description === 'string') {
          descriptionText = company.description;
        } else if (Array.isArray(company.description)) {
          // Extract text from rich text format
          descriptionText = company.description
            .map((block: any) => block.children?.map((child: any) => child.text).join(''))
            .join(' ');
        }
        if (descriptionText.toLowerCase().includes(searchTerm)) return true;
      }
      
      // Check headquarters
      if (company.headquarters && company.headquarters.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      return false;
    });
  }
  
  /**
   * Get companies by funding range
   */
  async getByFundingRange(minFunding?: number, maxFunding?: number): Promise<Company[]> {
    const data = await this.getData();
    
    return data.companies.filter(company => {
      if (!company.funding_total) return minFunding === undefined;
      
      const funding = company.funding_total;
      const meetsMin = minFunding === undefined || funding >= minFunding;
      const meetsMax = maxFunding === undefined || funding <= maxFunding;
      
      return meetsMin && meetsMax;
    });
  }
  
  /**
   * Get companies by size
   */
  async getBySize(size: string): Promise<Company[]> {
    const data = await this.getData();
    return data.companies.filter(company => company.size === size);
  }
  
  /**
   * Add or update a company
   */
  async upsert(company: Company): Promise<void> {
    await this.update(async (data) => {
      // Remove existing company if updating
      const existingIndex = data.companies.findIndex(c => c.id === company.id);
      if (existingIndex !== -1) {
        data.companies[existingIndex] = company;
      } else {
        data.companies.push(company);
      }
      
      // Rebuild indices
      this.rebuildIndices(data);
    });
  }
  
  /**
   * Delete a company
   */
  async delete(id: string): Promise<boolean> {
    let deleted = false;
    
    await this.update(async (data) => {
      const index = data.companies.findIndex(c => c.id === id);
      if (index !== -1) {
        data.companies.splice(index, 1);
        this.rebuildIndices(data);
        deleted = true;
      }
    });
    
    return deleted;
  }
  
  /**
   * Get companies sorted by name
   */
  async getAllSorted(): Promise<Company[]> {
    const data = await this.getData();
    return [...data.companies].sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * Get companies sorted by funding
   */
  async getByFundingDescending(): Promise<Company[]> {
    const data = await this.getData();
    return [...data.companies]
      .filter(company => company.funding_total !== null && company.funding_total !== undefined)
      .sort((a, b) => (b.funding_total || 0) - (a.funding_total || 0));
  }
  
  /**
   * Get unique company sizes
   */
  async getUniqueSizes(): Promise<string[]> {
    const data = await this.getData();
    const sizes = new Set<string>();
    
    for (const company of data.companies) {
      if (company.size) {
        sizes.add(company.size);
      }
    }
    
    return Array.from(sizes).sort();
  }
  
  /**
   * Get companies founded in a specific year range
   */
  async getByFoundedRange(startYear?: number, endYear?: number): Promise<Company[]> {
    const data = await this.getData();
    
    return data.companies.filter(company => {
      if (!company.founded) return false;
      
      const foundedYear = parseInt(company.founded);
      if (isNaN(foundedYear)) return false;
      
      const meetsStart = startYear === undefined || foundedYear >= startYear;
      const meetsEnd = endYear === undefined || foundedYear <= endYear;
      
      return meetsStart && meetsEnd;
    });
  }
  
  /**
   * Rebuild all indices
   */
  private rebuildIndices(data: CompaniesData): void {
    // Clear indices
    data.index.byId = {};
    data.index.bySlug = {};
    
    // Rebuild
    for (const company of data.companies) {
      data.index.byId[company.id] = company;
      data.index.bySlug[company.slug] = company;
    }
    
    // Update metadata
    data.metadata.total = data.companies.length;
    data.metadata.last_updated = new Date().toISOString();
  }
  
  /**
   * Get companies statistics
   */
  async getStatistics(): Promise<{
    total: number;
    withFunding: number;
    avgFunding: number;
    totalFunding: number;
    bySizeCount: Record<string, number>;
  }> {
    const data = await this.getData();
    
    const withFunding = data.companies.filter(c => c.funding_total && c.funding_total > 0);
    const totalFunding = withFunding.reduce((sum, c) => sum + (c.funding_total || 0), 0);
    const avgFunding = withFunding.length > 0 ? totalFunding / withFunding.length : 0;
    
    const bySizeCount: Record<string, number> = {};
    for (const company of data.companies) {
      if (company.size) {
        bySizeCount[company.size] = (bySizeCount[company.size] || 0) + 1;
      }
    }
    
    return {
      total: data.companies.length,
      withFunding: withFunding.length,
      avgFunding,
      totalFunding,
      bySizeCount
    };
  }
}