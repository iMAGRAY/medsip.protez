#!/usr/bin/env node

/**
 * Enhanced Migration CLI Runner
 * 
 * Command-line interface для запуска enhanced migration с опциями
 */

// Try to require commander, fall back to manual CLI if not available
let program;
try {
  const { Command } = require('commander');
  program = new Command();
} catch (error) {
  console.log('Commander.js not available, using simplified CLI');
  program = null;
}
const { EnhancedMigrationRunner } = require('./enhanced-sizes-to-variants-migration');
const { MigrationValidator } = require('./migration-validator');
const readline = require('readline');

// CLI color utilities
const colors = {
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  blue: (text) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function runValidation() {
  console.log(colors.blue(colors.bold('\n🔍 Running Pre-Migration Validation...\n')));
  
  const validator = new MigrationValidator();
  try {
    const results = await validator.generateValidationReport();
    
    // Check for blocking issues
    const hasOrphanedSizes = results.constraints.orphaned_sizes > 0;
    const hasSkuConflicts = results.conflicts.sku_conflicts?.length > 0;
    const hasNameConflicts = results.conflicts.name_conflicts?.length > 0;
    
    if (hasOrphanedSizes || hasSkuConflicts || hasNameConflicts) {
      console.log(colors.yellow('\n⚠️  WARNING: Issues detected that may affect migration:'));
      if (hasOrphanedSizes) {
        console.log(colors.yellow(`   - ${results.constraints.orphaned_sizes} orphaned size records`));
      }
      if (hasSkuConflicts) {
        console.log(colors.yellow(`   - ${results.conflicts.sku_conflicts.length} SKU conflicts`));
      }
      if (hasNameConflicts) {
        console.log(colors.yellow(`   - ${results.conflicts.name_conflicts.length} name conflicts`));
      }
      console.log(colors.yellow('\nThese will be handled during migration, but review the report.'));
    } else {
      console.log(colors.green('\n✅ No blocking issues detected. Migration should proceed smoothly.'));
    }
    
    return results;
  } finally {
    await validator.close();
  }
}

async function runMigration(options = {}) {
  console.log(colors.blue(colors.bold('\n🚀 Starting Enhanced Migration Process...\n')));
  
  const runner = new EnhancedMigrationRunner();
  
  try {
    await runner.run();
    console.log(colors.green(colors.bold('\n🎉 Migration completed successfully!')));
    return true;
  } catch (error) {
    console.error(colors.red(colors.bold('\n💥 Migration failed:')), error.message);
    return false;
  }
}

async function promptConfirmation(message) {
  const rl = createReadlineInterface();
  try {
    const answer = await askQuestion(rl, `${message} (y/N): `);
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

async function interactiveMode() {
  console.log(colors.cyan(colors.bold('\n🔧 Enhanced Migration - Interactive Mode\n')));
  console.log('This will migrate data from product_sizes to product_variants table.');
  console.log('The process includes backup, validation, and rollback capabilities.\n');
  
  // Step 1: Validation
  const runValidationStep = await promptConfirmation(
    colors.yellow('Run pre-migration validation?')
  );
  
  let validationResults = null;
  if (runValidationStep) {
    validationResults = await runValidation();
    
    if (!await promptConfirmation(colors.yellow('\nContinue with migration?'))) {
      console.log(colors.blue('Migration cancelled by user.'));
      return;
    }
  }
  
  // Step 2: Final confirmation
  console.log(colors.yellow('\n⚠️  IMPORTANT NOTES:'));
  console.log('• A backup will be created automatically');
  console.log('• Schema will be enhanced with new columns');
  console.log('• Existing product_variants will be preserved');
  console.log('• Rollback is available if needed');
  console.log('• Process may take several minutes for large datasets');
  
  const confirmed = await promptConfirmation(
    colors.red(colors.bold('\nProceed with migration?'))
  );
  
  if (!confirmed) {
    console.log(colors.blue('Migration cancelled by user.'));
    return;
  }
  
  // Step 3: Run migration
  const success = await runMigration();
  
  if (success) {
    console.log(colors.green('\n📋 NEXT STEPS:'));
    console.log('1. Review the migration report');
    console.log('2. Test your application with the new schema');
    console.log('3. Update API endpoints to use product_variants');
    console.log('4. Update frontend code');
    console.log('5. After thorough testing, consider dropping product_sizes table');
  } else {
    console.log(colors.red('\n🔄 RECOVERY OPTIONS:'));
    console.log('1. Check the migration log for specific errors');
    console.log('2. Fix data issues and re-run migration');
    console.log('3. Use rollback if needed (check backup directory)');
  }
}

// Commander.js setup (if available)
if (program) {
  program
    .name('run-enhanced-migration')
    .description('Enhanced migration tool for product_sizes → product_variants')
    .version('1.0.0');
}

// Setup commands if commander is available
if (program) {
  program
    .command('validate')
    .description('Run pre-migration validation only')
    .action(async () => {
      try {
        await runValidation();
        process.exit(0);
      } catch (error) {
        console.error(colors.red('Validation failed:'), error.message);
        process.exit(1);
      }
    });

  program
    .command('migrate')
    .description('Run migration without validation')
    .option('--force', 'Skip confirmation prompts')
    .action(async (options) => {
      try {
        if (!options.force) {
          const confirmed = await promptConfirmation(
            colors.red('Are you sure you want to run migration without validation?')
          );
          if (!confirmed) {
            console.log('Migration cancelled.');
            return;
          }
        }
        
        const success = await runMigration(options);
        process.exit(success ? 0 : 1);
      } catch (error) {
        console.error(colors.red('Migration failed:'), error.message);
        process.exit(1);
      }
    });

  program
    .command('full')
    .description('Run validation followed by migration')
    .option('--auto-confirm', 'Automatically confirm after validation')
    .action(async (options) => {
      try {
        // Run validation
        await runValidation();
        
        // Confirmation
        if (!options.autoConfirm) {
          const confirmed = await promptConfirmation(
            colors.yellow('Proceed with migration?')
          );
          if (!confirmed) {
            console.log('Migration cancelled.');
            return;
          }
        }
        
        // Run migration
        const success = await runMigration();
        process.exit(success ? 0 : 1);
      } catch (error) {
        console.error(colors.red('Process failed:'), error.message);
        process.exit(1);
      }
    });

  program
    .command('interactive')
    .description('Run in interactive mode with prompts')
    .action(async () => {
      try {
        await interactiveMode();
      } catch (error) {
        console.error(colors.red('Interactive mode failed:'), error.message);
        process.exit(1);
      }
    });

  // Default action (interactive mode)
  program.action(async () => {
    try {
      await interactiveMode();
    } catch (error) {
      console.error(colors.red('Interactive mode failed:'), error.message);
      process.exit(1);
    }
  });

  // Add help examples (if supported)
  if (program.addHelpText) {
    program.addHelpText('after', `

Examples:
  $ node run-enhanced-migration.js                    # Interactive mode
  $ node run-enhanced-migration.js validate          # Pre-migration validation only
  $ node run-enhanced-migration.js migrate --force   # Migration without prompts
  $ node run-enhanced-migration.js full              # Validation + migration
  $ node run-enhanced-migration.js interactive       # Full interactive mode

Environment Variables:
  DATABASE_URL         Full PostgreSQL connection string
  POSTGRESQL_HOST      Database host (default: localhost)
  POSTGRESQL_PORT      Database port (default: 5432)
  POSTGRESQL_USER      Database user (default: postgres)
  POSTGRESQL_PASSWORD  Database password
  POSTGRESQL_DBNAME    Database name (default: default_db)

Files Created:
  database/migration-backups/
    ├── [migration-id]_backup.json     # Data backup
    ├── [migration-id]_report.json     # Migration report
    ├── [migration-id].log             # Detailed log
    └── validation-report-[time].json  # Validation report
`);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(colors.red('Uncaught exception:'), error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(colors.red('Unhandled rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// Fallback CLI for when commander is not available
async function simpleCLI() {
  const args = process.argv ? process.argv.slice(2) : [];
  const command = args[0];

  switch (command) {
    case 'validate':
      console.log(colors.blue('Running validation only...'));
      await runValidation();
      break;
    case 'migrate':
      console.log(colors.blue('Running migration...'));
      await runMigration();
      break;
    case 'full':
      console.log(colors.blue('Running full process...'));
      await runValidation();
      await runMigration();
      break;
    case 'help':
    case '--help':
    case '-h':
      console.log(`
${colors.cyan(colors.bold('Enhanced Migration Tool'))} - product_sizes → product_variants

Usage:
  node run-enhanced-migration.js [command] [options]

Commands:
  validate    Run pre-migration validation only
  migrate     Run migration
  full        Run validation + migration
  interactive Default interactive mode (requires readline)

Options:
  --help      Show this help message

Example:
  node run-enhanced-migration.js validate
      `);
      break;
    default:
      console.log(colors.cyan('Starting enhanced migration in simple mode...'));
      console.log('Use --help for available commands');
      await runMigration();
  }
}

// Parse command line arguments
if (require.main === module) {
  try {
    if (program) {
      program.parse();
    } else {
      simpleCLI().catch(error => {
        console.error(colors.red('CLI failed:'), error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
      });
    }
  } catch (error) {
    console.error('Initialization error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}