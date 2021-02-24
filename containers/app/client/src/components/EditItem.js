import React, { useState, useEffect } from 'react';

import Grid from '@material-ui/core/Grid';
import Navbar from './Navbar';
import { makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useHistory } from "react-router-dom";
import CircularProgress from '@material-ui/core/CircularProgress';
import { Typography } from '@material-ui/core';
import {
  useParams
} from "react-router-dom";

import {buildTransaction} from '../helpers/signing';


import axios from 'axios';

function sleep(time){
  return new Promise((resolve) => {
    setTimeout(()=>{
      resolve();
    }, time);
  });
}

const useStyles = makeStyles(() => ({
  root: {
    flexGrow: 1,
    padding: '30px',
  },
}));

function CreateItem(){
  const classes = useStyles();
  const history = useHistory();
  let { id } = useParams();

  let [ elem, setElem ] = useState(null);
  let [ elemQueried, setElemQueried ] = useState(false);

  useEffect(()=>{
    axios.get('/api/'+id)
      .then((res) => {
        setElem(res.data);
        setElemQueried(true);
      })
      .catch(()=>{
        setElemQueried(false);
      });

  }, [id]);

  const formik = useFormik({
    initialValues: {
      text: (elem)? elem.value.value: '',
      owner: (elem)? elem.value.owner: ''
    },
    enableReinitialize: true,
    validationSchema: Yup.object({
      text: Yup.string().required('Required')
    }),
    onSubmit: async (values, {setStatus}) => {
    

      try{
        const payload = {
          type: 'todo',
          
          input: id,
          output:{
            value: elem.value.value,
            owner: values.owner
          }
        };
 
        let transaction = await buildTransaction(payload);
                
        await axios.put('/api/', transaction);
  
        await sleep(1000);
  
        history.replace('/dashboard');
      }
      catch(e){
        let error;
        if(e.response){
          error = JSON.stringify(e.response.data);
        }else{
          error = e.message;
        }
        setStatus({error});
      }

    },
  });

  return (
    <React.Fragment>
      <Navbar />
      <form noValidate autoComplete="off" onSubmit={formik.handleSubmit}>
        <Grid container className={classes.root} spacing={2} direction="column" jusify="center" alignItems="center">
          <Grid item xs={12} md={4} style={{width:"100%", display: 'flex', flexDirection: 'column', alignItems: "center"}} >
            <Typography noWrap variant="h4">
              ToDo
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} style={{width:"100%"}}>
            <Typography variant="body1" noWrap>
              {id} {(elemQueried && !elem)? ', Not found': ''}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4} style={{width:"100%"}}>
            <TextField 
              id="text" 
              label="Text" 
              value={formik.values.text}
              onChange={formik.handleChange}
              error={formik.touched.text && Boolean(formik.errors.text)}
              helperText={formik.touched.text && formik.errors.text}
              // disabled={formik.isSubmitting || !elem}
              disabled={true}
              autoFocus
              fullWidth
            />
          </Grid>

          <Grid item xs={12} md={4} style={{width:"100%"}}>
            <TextField 
              id="owner" 
              label="owner" 
              value={formik.values.owner}
              onChange={formik.handleChange}
              error={formik.touched.text && Boolean(formik.errors.owner)}
              helperText={formik.touched.owner && formik.errors.owner}
              disabled={formik.isSubmitting || !elem}
              autoFocus
              fullWidth
            />
          </Grid>

          { formik.isSubmitting &&
            <Grid item xs={12}>
              <CircularProgress />
            </Grid>
          }

          { formik.status &&
            <Grid item xs={12}>
              <Typography variant="body1" color="error">
                { formik.status.error }
              </Typography>
            </Grid>
          }

          <Grid item xs={12}>
            <Grid container spacing={2}>
              <Grid item>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  className={classes.submit}
                  disabled={formik.isSubmitting || !elem}
                >
                  Save
                </Button>
              </Grid>
              <Grid item>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="default"
                  className={classes.submit}
                  disabled={formik.isSubmitting}
                  onClick={()=>{history.push('/dashboard')}}
                >
                  Cancel
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </form>
    </React.Fragment>
  );
}

export default CreateItem;