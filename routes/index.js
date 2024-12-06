/*	index.js
	by Blaine Harper

	PURPOSE: router for api index
*/	


const express = require('express')
const router = express.Router()
require('dotenv').config({path: `.env.${process.env.NODE_ENV}`})
const path = require('path')
const fs = require('fs')

const { requiresAuth } = require('express-openid-connect')
const { isAuthenticated } = require('./utils/auth')
const { SQLObject } = require('@bhar2254/mysql')
const { debugLog } = require('./utils/harper')

/* GET cover page. */
router.get('/', function(req, res, next){
	if(req.oidc.isAuthenticated())
		return res.redirect('/home')
	return res.render('base/mixins/cover', { env: req.env,
		title: `Welcome to ${req.env.title}!`, subtitle: req.env.tagline})
})

/* GET cover page. */
router.get('/home', isAuthenticated,
	async function(req, res, next){
		return res.render('pages/basicText', { 
			env: req.env, 
			isAuthenticated: req.oidc.isAuthenticated(), 
			activeUser: req.activeUser || {},
			title:'Home', page:{
			content: [
				{parallax: {rem:'26', url:'res/plp/brothers/brothers_2022_small.jpg'}, hero : {title:'Phi Lambda Phi', content:req.env.tagline}},
				{parallax: {rem:'30', url:'res/plp/brothers/brothers_2020_small.jpg'}, hero : {title:'Our Mission', content:'Phi Lambda Phi is a National Fraternity founded on the campus of Truman State University in June of 2002. Phi Lambda prides itself on being the first organization on campus to abolish hazing. With this act, it has created an environment of inclusion and acceptance. Phi Lambda strives to provide an environment that fosters lifelong relationships, as well as academic excellence. The structure of the organization allows for deep and rich connections with every brother in the fraternity. Phi Lamb also has an extremely active alumni association that offers support and guidance from multiple generations of brothers. Phi Lambda has supported philanthropies that include but are not limited to: The Foodbank of Northeast and Central Missouri and The Adair County Humane Society. Giving back to the community that has given so much to Phi Lambda is one of the hallmarks of the organization and they strive to maintain it every semester.'}},
				{parallax: {rem:'30', url:'res/plp/brothers/brothers_2015_full.jpg'}, hero : {title:'Our History', content:'Founded in 2002 when local brothers felt that their chapter was heading in a different direction than the PLX National Board. With the help of Doc Murray, brothers were able to found a new organization keeping the Phi Lamb roots, but staying true to the values and principles of<br>Phi Lambda Phi.'}}
			]
		}
	})
})

/* GET gallery page. */
router.get('/gallery', function(req, res, next){
	return res.render('pages/gallery', {
		env: req.env, 
		isAuthenticated: req.oidc.isAuthenticated(),  
		activeUser: req.activeUser,
		title: 'Gallery', subtitle:'Khajit has wares, if you have the coin.', cards:SAMPLE_CARDS }
	)
})

/* POST insert. */
router.post('/insert/:table',
	requiresAuth(),
	async function (req, res, next) {
		const table = req.params.table || req.session.table
		const data = req.body
		const create = new SQLObject({ table, datum })
		// Sanitize inputs and trim whitespace

		// Sandwich the defaults and build object

		try {
			// Update the primary object in DB
			await create.create()
			req.session.returnResponse = 'createSuccess'
			const redirect = req.session.returnURI === '/users/me' ? '/users/me' : `/view/${table}/${create.id}`
			return res.redirect(redirect)
		} catch (err) {
			console.error(err)
			req.session.returnResponse = 'createFailure'
			if(req.session.returnURI)
				return res.redirect(req.session.returnURI)
			const searchParams = new URLSearchParams(req.body)
			return res.redirect(`/new/${table}?${searchParams}`)
		}
	}
)

/* PUT update. */
router.post('/update/:table/:guid', 
	requiresAuth(),
	async (req, res, next) => {
		const { table, guid } = req.params
		const { activeUser } = req
		const activeUserUpdate = req.session.returnURI === '/users/me'

		try {
			debugLog('ATTPEMTING TO UPDATE OBJECT')
			const update = new SQLObject({table, id: guid})
			await update.update(req.body)
			debugLog(update.last.query)

			req.session.returnResponse = update._updateCounter ? 'updateSuccess' : 'notUpdated'
			if(activeUserUpdate){
				await update.read()
				req.activeUser = update
			}
			if(req.session.returnURI){
				debugLog(`Object updated!!! Returning to ${req.session.returnURI}`)
				return res.redirect(req.session.returnURI)
			}
			debugLog(`Object updated!!! No returnURI found. Returning to /view/${table}/${update.id}`)
			return res.redirect(`/view/${table}/${update.id}`)
		} catch (err) {
			console.error(err)
			const searchParams = new URLSearchParams(req.body)
			req.session.returnResponse = 'updateFailure'
			if(req.session.returnURI)
				return res.redirect(req.session.returnURI)
			if(guid)
				return res.redirect(`/play/view/${table}/${guid}?${searchParams}`)
			if(req.body.id)
				return res.redirect(`/play/view/${table}/${req.body.id}?${searchParams}`)
			return res.redirect('/404')
		}
})

router.get('/status', function(req, res, next){
	return res.send({'status':200})
})

// Routing for pictures to fetch images or return defaults in none exists
function getWebPFiles(directory) {
    const webpFiles = [];
    
    // Read the contents of the directory
    const files = fs.readdirSync(directory);
    
    // Loop through each file in the directory
    files.forEach(file => {
        // Check if the file is a .webp file
        if (path.extname(file).toLowerCase() === '.webp') {
            // Add the filename (without the extension) to the array
            webpFiles.push(file);
        }
    });
    
    return webpFiles.map(x => x.split('.webp')[0]);
}
const defaults_path = path.join(process.cwd(), 'public', 'res', 'app', 'photos','defaults')
const file_names = getWebPFiles(defaults_path)

file_names.map(x => {
	router.get(`/res/${x}/*`, function(req, res, next){
		// Set up the path to your images folder
		const imageBasePath = path.join(process.cwd(), 'public', 'res' );  // This assumes the images are under a 'res' folder

		// Default image to serve if the requested image doesn't exist
		const defaultImage = path.join(process.cwd(), 'public', 'res', 'app', 'photos', 'defaults', `${x}.webp`);

		const requestedImage = req.params[0];  // Capture everything after /res/default/app/photos/
		
		// Build the file path to the image
		const filePath = path.join(imageBasePath, requestedImage);
		
		// Check if the file exists
		fs.exists(filePath, (exists) => {
			if (exists) {
				// If the image exists, serve it
				res.sendFile(filePath);
			} else {
				// If the image does not exist, serve the default image
				res.sendFile(defaultImage);
			}
		});
	})
})

module.exports = router
