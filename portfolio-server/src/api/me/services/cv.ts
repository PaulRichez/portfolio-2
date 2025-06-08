'use strict';

const PdfPrinter = require('pdfmake');
const path = require('path');
const fs = require('fs');

// Fonction pour vérifier si un fichier existe
const fileExists = (filePath) => {
    try {
        return fs.existsSync(filePath);
    } catch (error) {
        return false;
    }
};

// Configuration des polices avec support Unicode et fallback
const getFonts = () => {
    const fontPaths = {
        normal: path.join(__dirname, '../../../../../node_modules/pdfmake-unicode/src/fonts/Arial GEO/Roboto-Regular.ttf'),
        bold: path.join(__dirname, '../../../../../node_modules/pdfmake-unicode/src/fonts/Arial GEO/Roboto-Medium.ttf'),
        italics: path.join(__dirname, '../../../../../node_modules/pdfmake-unicode/src/fonts/Arial GEO/Roboto-Italic.ttf'),
        bolditalics: path.join(__dirname, '../../../../../node_modules/pdfmake-unicode/src/fonts/Arial GEO/Roboto-MediumItalic.ttf')
    };

    // Vérifier si les polices existent
    const fontsExist = Object.values(fontPaths).every(fontPath => fileExists(fontPath));

    if (fontsExist) {
        return {
            ArialGEO: fontPaths
        };
    } else {
        // Fallback vers les polices système
        console.warn('Polices pdfmake-unicode non trouvées, utilisation des polices système');
        return {
            Helvetica: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
            }
        };
    }
};

const fonts = getFonts();
const defaultFont = fonts.ArialGEO ? 'ArialGEO' : 'Helvetica';

/**
 * Service pour générer le CV en PDF
 */
export default ({ strapi }) => ({

    /**
     * Génère le CV en PDF
     */
    async generateCvPdf() {
        try {
            // Récupérer les données depuis Strapi
            const meData = await this.getCvData();

            if (!meData) {
                throw new Error('Aucune donnée CV trouvée');
            }

            // Créer la définition du document PDF
            const docDefinition = this.createDocumentDefinition(meData);

            // Créer le PDF
            const printer = new PdfPrinter(fonts);
            const pdfDoc = printer.createPdfKitDocument(docDefinition);

            return pdfDoc;
        } catch (error) {
            console.error('Erreur lors de la génération du CV PDF:', error);
            throw error;
        }
    },

    /**
     * Récupère toutes les données nécessaires pour le CV
     */
    async getCvData() {
        try {
            const entity = await strapi.entityService.findMany('api::me.me', {
                populate: {
                    languages: true,
                    diplomas: true,
                    experiences: true,
                    coding_skills: {
                        populate: {
                            coding: true
                        }
                    }
                }
            });

            return entity;
        } catch (error) {
            console.error('Erreur lors de la récupération des données CV:', error);
            throw error;
        }
    },

  /**
   * Crée la définition du document PDF
   */  createDocumentDefinition(meData) {
        // Vérifications de sécurité
        if (!meData) {
            throw new Error('Données CV manquantes');
        }

        const age = this.calculateAge(meData.birthDay);

        // Colonne de gauche (sidebar)
        const leftColumn = [
            // Nom et poste
            {
                text: `${meData.firstName || ''} ${meData.lastName || ''}`,
                style: 'name',
                alignment: 'center',
                margin: [0, 10, 0, 3]
            },
            {
                text: meData.postName || 'Développeur',
                style: 'jobTitle',
                alignment: 'center',
                margin: [0, 0, 0, 3]
            },
            {
                text: `${age} ans - ${meData.city || ''}`,
                style: 'basicInfo',
                alignment: 'center',
                margin: [0, 0, 0, 10]
            },

            // Compétences techniques
            this.getCodingSkillsSection(meData.coding_skills || []),

            // Langues
            this.getLanguagesSection(meData.languages || []),

            // Contact
            this.getContactSection(meData)
        ];    // Colonne de droite (contenu principal)
        const rightColumn = [
            // Expériences
            this.getExperiencesSection(meData.experiences || []),

            // Diplômes
            this.getDiplomasSection(meData.diplomas || [])
        ]; const docDefinition = {
            pageSize: 'A4',
            pageOrientation: 'portrait',
            pageMargins: [0, 0, 0, 0],
            defaultStyle: {
                font: defaultFont,
                fontSize: 11,
                lineHeight: 1.3
            },
            info: {
                title: `${meData.firstName || ''} ${meData.lastName || ''} - CV`,
                author: `${meData.firstName || ''} ${meData.lastName || ''}`,
                subject: `CV de ${meData.firstName || ''} ${meData.lastName || ''}`,
                keywords: 'CV, Resume',
                creator: `${meData.firstName || ''} ${meData.lastName || ''}`,
            },
            styles: {
                name: {
                    fontSize: 18,
                    bold: true,
                    color: 'white'
                },
                jobTitle: {
                    fontSize: 14,
                    color: 'white',
                    margin: [0, 2, 0, 2]
                },
                basicInfo: {
                    fontSize: 12,
                    color: 'white'
                },
                sectionTitle: {
                    bold: true,
                    fontSize: 14,
                    margin: [0, 10, 0, 5],
                    decoration: 'underline',
                    color: 'white'
                },
                sectionTitleMain: {
                    bold: true,
                    fontSize: 14,
                    margin: [0, 10, 0, 5],
                    decoration: 'underline',
                    color: 'black'
                },
                skillName: {
                    fontSize: 10,
                    color: 'white',
                    margin: [0, 1, 0, 1]
                },
                contactInfo: {
                    fontSize: 10,
                    color: 'white',
                    margin: [0, 1, 0, 1]
                },
                experienceTitle: {
                    fontSize: 12,
                    bold: true,
                    margin: [0, 3, 0, 1]
                },
                experienceCompany: {
                    fontSize: 11,
                    italics: true,
                    margin: [0, 0, 0, 2]
                },
                experienceDate: {
                    fontSize: 10,
                    color: '#666666'
                },
                experienceDescription: {
                    fontSize: 10,
                    margin: [0, 1, 0, 1]
                },
                diplomaTitle: {
                    fontSize: 12,
                    bold: true,
                    margin: [0, 3, 0, 1]
                },
                diplomaDescription: {
                    fontSize: 11,
                    margin: [0, 0, 0, 2]
                }
            }, content: [
                {
                    table: {
                        widths: [200, '*'],
                        heights: [839.5], // Hauteur A4 en points (297mm = ~842 points)
                        body: [
                            [
                                {
                                    stack: leftColumn,
                                    color: 'white',
                                    margin: [10, 10, 10, 10],
                                    fillColor: '#2c3e50'
                                },
                                {
                                    stack: rightColumn,
                                    margin: [10, 10, 10, 10]
                                }
                            ]
                        ]
                    },
                    layout: {
                        fillColor: function (rowIndex, node, columnIndex) {
                            return (columnIndex === 0) ? '#2c3e50' : null;
                        },
                        defaultBorder: false,
                        paddingLeft: function () { return 0; },
                        paddingRight: function () { return 0; },
                        paddingTop: function () { return 0; },
                        paddingBottom: function () { return 0; }
                    }
                }
            ]
        };

        return docDefinition;
    },

    /**
     * Section des compétences techniques
     */
    getCodingSkillsSection(codingSkills) {
        if (!codingSkills || codingSkills.length === 0) {
            return { text: '' };
        }

        const skillsStack = [
            { text: 'Compétences', style: 'sectionTitle' }
        ];

        // Grouper les compétences par catégorie
        const skillsByCategory = {};
        codingSkills.forEach(skill => {
            const category = skill.coding?.category || 'other';
            if (!skillsByCategory[category]) {
                skillsByCategory[category] = [];
            }
            skillsByCategory[category].push(skill);
        });    // Ajouter chaque catégorie
        Object.keys(skillsByCategory).forEach(category => {
            const categoryName = this.getCategoryDisplayName(category);
            skillsStack.push({
                text: categoryName,
                style: 'skillName',
                bold: true,
                margin: [0, 5, 0, 2]
            } as any); skillsByCategory[category].forEach(skill => {
                const levelIndicator = this.getLevelIndicator(skill.level);
                skillsStack.push({
                    text: `${skill.coding?.name || 'N/A'} ${levelIndicator}`,
                    style: 'skillName'
                });
            });
        });

        return { stack: skillsStack };
    },

    /**
     * Section des langues
     */
    getLanguagesSection(languages) {
        if (!languages || languages.length === 0) {
            return { text: '' };
        }

        const languagesStack = [
            { text: 'Langues', style: 'sectionTitle' }
        ];

        languages.forEach(language => {
            const levelLabel = this.getLanguageLevelLabel(language.value);
            languagesStack.push({
                text: `${language.name} ${levelLabel}`,
                style: 'skillName'
            });
        });

        return { stack: languagesStack };
    },

    /**
     * Section contact
     */
    getContactSection(meData) {
        const contactStack = [
            { text: 'Contact', style: 'sectionTitle' }
        ];

        if (meData.email) {
            contactStack.push({ 
                text: meData.email, 
                style: 'contactInfo',
                link: `mailto:${meData.email}`,
                decoration: 'underline'
            } as any);
        }
        if (meData.phoneNumber) {
            contactStack.push({ 
                text: meData.phoneNumber, 
                style: 'contactInfo',
                link: `tel:${meData.phoneNumber}`,
                decoration: 'underline'
            } as any);
        }
        if (meData.linkedin) {
            contactStack.push({ 
                text: meData.linkedin, 
                style: 'contactInfo',
                link: meData.linkedin.startsWith('http') ? meData.linkedin : `https://${meData.linkedin}`,
                decoration: 'underline'
            } as any);
        }
        if (meData.github) {
            contactStack.push({ 
                text: meData.github, 
                style: 'contactInfo',
                link: meData.github.startsWith('http') ? meData.github : `https://${meData.github}`,
                decoration: 'underline'
            } as any);
        }
        if (meData.website) {
            contactStack.push({ 
                text: meData.website, 
                style: 'contactInfo',
                link: meData.website.startsWith('http') ? meData.website : `https://${meData.website}`,
                decoration: 'underline'
            } as any);
        }

        return { stack: contactStack };
    },

    /**
     * Section des expériences
     */
    getExperiencesSection(experiences) {
        if (!experiences || experiences.length === 0) {
            return { text: '' };
        }

        const experiencesStack = [
            { text: 'Expériences', style: 'sectionTitleMain' }
        ];

        experiences.forEach(experience => {
            const dateRange = this.formatDateRange(experience.startDate, experience.endDate);
            experiencesStack.push({
                text: `${dateRange} - ${experience.title} chez ${experience.business}`,
                style: 'experienceTitle',
                margin: [0, 5, 0, 2]
            } as any);

            if (experience.businessWebsite) {
                experiencesStack.push({
                    text: experience.businessWebsite,
                    style: 'experienceCompany',
                    link: experience.businessWebsite.startsWith('http') ? experience.businessWebsite : `https://${experience.businessWebsite}`,
                    decoration: 'underline'
                } as any);
            }

            // Ajouter les descriptions si disponibles
            if (experience.descriptions && Array.isArray(experience.descriptions)) {
                experience.descriptions.forEach(desc => {
                    experiencesStack.push({
                        text: `• ${desc}`,
                        style: 'experienceDescription',
                        margin: [10, 1, 0, 1]
                    } as any);
                });
            }
        });

        return { stack: experiencesStack };
    },

    /**
     * Section des diplômes
     */
    getDiplomasSection(diplomas) {
        if (!diplomas || diplomas.length === 0) {
            return { text: '' };
        }

        const diplomasStack = [
            { text: 'Diplômes', style: 'sectionTitleMain' }
        ];

        diplomas.forEach(diploma => {
            const dateRange = this.formatDateRange(diploma.startDate, diploma.endDate);
            diplomasStack.push({
                text: `${dateRange} - ${diploma.title}`,
                style: 'diplomaTitle',
                margin: [0, 5, 0, 1]
            } as any);

            if (diploma.description) {
                diplomasStack.push({
                    text: diploma.description,
                    style: 'diplomaDescription'
                });
            }
        });

        return { stack: diplomasStack };
    },

    /**
     * Calcule l'âge à partir de la date de naissance
     */
    calculateAge(birthDate) {
        if (!birthDate) return 'N/A';

        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        return age;
    },

    /**
     * Formate une plage de dates
     */
    formatDateRange(startDate, endDate) {
        if (!startDate) return '';

        const start = new Date(startDate);
        const startYear = start.getFullYear();

        if (!endDate) {
            return `Depuis ${startYear}`;
        }

        const end = new Date(endDate);
        const endYear = end.getFullYear();

        if (startYear === endYear) {
            return `En ${startYear}`;
        }

        return `De ${startYear} à ${endYear}`;
    },

    /**
     * Obtient le nom d'affichage pour une catégorie
     */
    getCategoryDisplayName(category) {
        const categoryNames = {
            'frontend_languages': 'Langages Frontend',
            'frontend_frameworks': 'Frameworks Frontend',
            'backend': 'Backend',
            'databases': 'Bases de données',
            'devops_tools': 'DevOps',
            'tools': 'Outils',
            'other_languages': 'Autres langages'
        };

        return categoryNames[category] || category;
    },
    /**
     * Obtient le label de niveau pour une langue basé sur le pourcentage
     */
    getLanguageLevelLabel(percentage) {
        if (!percentage) return '○○○○○';
        
        if (percentage >= 75) return '●●●●○';
        if (percentage >= 50) return '●●●○○';
        if (percentage >= 25) return '●●○○○';
        return '●○○○○';
    },
    /**
     * Obtient l'indicateur de niveau
     */
    getLevelIndicator(level) {
        const levels = {
            'beginner': '●○○○',
            'Intermediate': '●●○○',
            'advanced': '●●●○',
            'expert': '●●●●'
        };

        return levels[level] || '○○○○';
    }
});
