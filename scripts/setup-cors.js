import {Storage} from '@google-cloud/storage';
import {readFileSync} from 'fs';

async function configureCORS() {
  // Lê a configuração do Firebase
  const firebaseConfig = JSON.parse(readFileSync('./firebase.json', 'utf8'));
  
  const storage = new Storage({
    projectId: 'norahub-2655f',
    // Usa credenciais da aplicação padrão
  });

  const bucketName = 'norahub-2655f.appspot.com';

  const corsConfiguration = [
    {
      origin: ['http://localhost:5173', 'https://norahub-2655f.web.app', 'https://norahub-2655f.firebaseapp.com'],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'],
      responseHeader: ['Content-Type'],
      maxAgeSeconds: 3600,
    },
  ];

  try {
    console.log('🔧 Tentando configurar CORS...');
    console.log('Bucket:', bucketName);
    
    // Tenta criar o bucket se não existir
    try {
      const [bucketExists] = await storage.bucket(bucketName).exists();
      if (!bucketExists) {
        console.log('📦 Criando bucket...');
        await storage.createBucket(bucketName, {
          location: 'SOUTHAMERICA-EAST1',
          storageClass: 'STANDARD',
        });
        console.log('✅ Bucket criado!');
      } else {
        console.log('✅ Bucket já existe!');
      }
    } catch (bucketError) {
      console.log('ℹ️  Bucket já existe ou erro ao verificar:', bucketError.message);
    }

    // Configura CORS
    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
    console.log('✅ CORS configurado com sucesso!');
    console.log('Configuração aplicada:', JSON.stringify(corsConfiguration, null, 2));
    
    // Verifica a configuração
    const [metadata] = await storage.bucket(bucketName).getMetadata();
    console.log('📋 CORS atual:', JSON.stringify(metadata.cors, null, 2));
    
  } catch (error) {
    console.error('❌ Erro ao configurar CORS:', error.message);
    console.error('Detalhes:', error);
    console.log('\n💡 Solução alternativa:');
    console.log('1. Acesse: https://console.cloud.google.com/storage/browser?project=norahub-2655f');
    console.log('2. Clique no bucket: norahub-2655f.appspot.com');
    console.log('3. Vá em "Configuração" > "Editar CORS"');
    console.log('4. Cole o conteúdo do arquivo cors.json');
  }
}

configureCORS();
