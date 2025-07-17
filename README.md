
# Guía de Uso - Graphs and Routes

## Tabla de Contenido

1. [Introduccion](#que-es)
2. [Peticiones](#como-hacer-peticiones)
3. [Modificar](#donde-agregar-nuevos-cambios)
4. [Ejecucion Local](#como-ejecutar-en-local)

### Que es?

Un servicio externo el cual su finalidad es ser usado por Correos de Mexico Monorepo para mediante metodos get, obtener:

- Grafos de las Sucursales de Correos de Mexico en el pais (nacional/multi-estatal/estatal )

- Obtener rutas de un nodo a otro (de una sucursal a otra)

- Ver de forma grafica estos 2 casos (el grafo de sucursales y el grafo de la ruta)



### Como hacer peticiones?

En lo que respecta al uso de peticiones, utiliza:

- Tudireccion.com/docs

- localhost:port/docs

Estos directorios seran donde se encuentre un documento el cual tiene ejemplos de como se realiza la peticion y ejemplos de outputs



### Donde agregar nuevos cambios?

Primeramente, esto dependera del tipo de cambio
Respecto a:

- Controlador

>Todo a como se maneja la logica, en este caso recibir las peticiones (ejemplo: GET), al acceder a una ruta se encargara la logica a ejecutar

>Guarda el archivo ts en la carpeta Controllers, dentro de Src (source)

- Servicio

>Todo en cuanto a la logica del servicio, vease procesos, llamadas, etc., separa la logica de las funciones (en resumen, lo que hace el controlador pero separandolo para mayor claridad)

> Guarda el archivo ts en la carpeta Services, dentro de Src (source)

- Ruta

>Todo en cuanto a definir las URLs disponibles, sea tanto para acceder, por ejemplo, a grafo, ruta o visualizador, se encarga de conectar cada URL con su respectivo controlador

>Guarda el archivo ts en la carpeta Routes, dentro de Src (source)

### Como ejecutar en local?
en el package.json, agregar/remplazar lo siguiente:
```
"start": "ts-node src/server.ts",
"dev": "nodemon --watch 'src/**/*.ts' --exec 'ts-node' src/server.ts"
```

en tsconfig.json, agregar/remplazar lo siguiente:

```
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "skipLibCheck": true
  }
}

```

usar el comando para ejecutarlo:
```
npm run start
```

se te dara la direccion en el siguiente formato:
```
localhost:puerto
```

para comprobar si se cargo correctamente, intenta utilizar:

```
localhost:puerto/docs
```
se debera mostrar un html que contentga la documentacion de las peticiones, si carga correctamente, entonces puedes proceder a realizar las pruebas, implementaciones o cualquier cosa que sea necesaria


### debug
